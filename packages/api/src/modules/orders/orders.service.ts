import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
    constructor(
        private prisma: PrismaService,
        private notifications: NotificationsService,
    ) {}

    // Buyer: accept a quotation → create order
    async acceptQuotation(quotationId: string, buyerId: string) {
        const quotation = await this.prisma.quotation.findUnique({
            where: { id: quotationId },
            include: {
                items: true,
                cart: {
                    include: { user: true },
                },
            },
        });

        if (!quotation) throw new NotFoundException('Quotation not found');
        if (quotation.cart.userId !== buyerId) {
            throw new BadRequestException('This quotation is not for you');
        }
        if (quotation.status !== 'sent') {
            throw new BadRequestException('This quotation cannot be accepted');
        }

        // Check expiry
        if (quotation.expiresAt && new Date() > quotation.expiresAt) {
            await this.prisma.quotation.update({
                where: { id: quotationId },
                data: { status: 'expired' },
            });
            throw new BadRequestException('This quotation has expired');
        }

        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

        const [, order] = await this.prisma.$transaction(async (tx) => {
            const uq = await tx.quotation.update({
                where: { id: quotationId },
                data: { status: 'accepted' },
            });

            const o = await tx.order.create({
                data: {
                    orderNumber,
                    buyerId,
                    salesPersonId: quotation.createdById,
                    quotationId: quotation.id,
                    status: 'pending_payment',
                    totalAmount: quotation.quotedTotal || new Prisma.Decimal(0),
                    items: {
                        create: quotation.items.map((item) => ({
                            quotationItemId: item.id,
                            source: 'inventory',
                            productName: `Quotation Item`,
                            quantity: item.quantity,
                            unitPrice: item.finalUnitPrice,
                            lineTotal: item.lineTotal,
                        })),
                    },
                },
                include: { items: true },
            });

            // Update cart status
            await tx.intendedCart.update({
                where: { id: quotation.cartId },
                data: { status: 'quoted' },
            });

            return [uq, o];
        });

        // Notify sales person
        if (quotation.createdById) {
            const buyerName = [quotation.cart.user?.firstName, quotation.cart.user?.lastName].filter(Boolean).join(' ') || quotation.cart.user?.email || 'Buyer';
            await this.notifications.notifyQuoteAccepted(quotation.createdById, quotation.id, buyerName);
        }

        // Notify buyer
        await this.notifications.notifyOrderCreated(buyerId, order.id, orderNumber);

        return order;
    }

    // Buyer: reject a quotation
    async rejectQuotation(quotationId: string, buyerId: string, reason?: string) {
        const quotation = await this.prisma.quotation.findUnique({
            where: { id: quotationId },
            include: { cart: true },
        });

        if (!quotation) throw new NotFoundException('Quotation not found');
        if (quotation.cart.userId !== buyerId) {
            throw new BadRequestException('This quotation is not for you');
        }
        if (quotation.status !== 'sent') {
            throw new BadRequestException('This quotation cannot be rejected');
        }

        return this.prisma.quotation.update({
            where: { id: quotationId },
            data: {
                status: 'rejected',
                terms: reason ? `Buyer rejection: ${reason}` : quotation.terms,
            },
        });
    }

    // Buyer: get my orders
    async getMyOrders(buyerId: string) {
        return this.prisma.order.findMany({
            where: { buyerId },
            include: {
                items: true,
                quotation: true,
                payments: true,
                shipments: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // Buyer: get single order
    async getOrder(orderId: string, buyerId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: true,
                quotation: {
                    include: { items: true },
                },
                payments: true,
                shipments: true,
                salesPerson: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });

        if (!order) throw new NotFoundException('Order not found');
        if (order.buyerId !== buyerId) {
            throw new BadRequestException('This order is not yours');
        }

        return order;
    }

    // Buyer: initiate payment
    async initiatePayment(
        orderId: string,
        buyerId: string,
        data: {
            method: 'card' | 'bank_transfer' | 'upi';
            amount: number;
            transactionRef?: string;
        },
    ) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) throw new NotFoundException('Order not found');
        if (order.buyerId !== buyerId) {
            throw new BadRequestException('This order is not yours');
        }
        if (!['pending_payment'].includes(order.status)) {
            throw new BadRequestException('Payment not applicable for this order status');
        }

        const payment = await this.prisma.payment.create({
            data: {
                orderId,
                amount: data.amount,
                method: data.method,
                status: data.method === 'bank_transfer' ? 'pending' : 'processing',
                gatewayRef: data.transactionRef,
                expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48hr expiry
            },
        });

        // For card/upi — simulate immediate payment success
        if (data.method === 'card' || data.method === 'upi') {
            await this.prisma.$transaction(async (tx) => {
                await tx.payment.update({
                    where: { id: payment.id },
                    data: {
                        status: 'paid',
                        paidAt: new Date(),
                    },
                });

                const newPaidAmount = Number(order.paidAmount) + data.amount;
                const totalAmount = Number(order.totalAmount);
                const newStatus = newPaidAmount >= totalAmount ? 'confirmed' : 'pending_payment';

                await tx.order.update({
                    where: { id: orderId },
                    data: {
                        paidAmount: newPaidAmount,
                        status: newStatus,
                    },
                });
            });

            await this.notifications.notifyPaymentReceived(buyerId, orderId, order.orderNumber);
        }

        return payment;
    }

    // Buyer: view quotation
    async getQuotationForBuyer(quotationId: string, buyerId: string) {
        const quotation = await this.prisma.quotation.findUnique({
            where: { id: quotationId },
            include: {
                items: {
                    include: {
                        cartItem: {
                            include: {
                                recommendationItem: {
                                    include: {
                                        inventorySku: true,
                                        manufacturerItem: true,
                                    },
                                },
                            },
                        },
                    },
                },
                cart: {
                    include: { user: true },
                },
                createdBy: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });

        if (!quotation) throw new NotFoundException('Quotation not found');
        if (quotation.cart.userId !== buyerId) {
            throw new BadRequestException('This quotation is not for you');
        }

        // Auto-expire check
        if (quotation.status === 'sent' && quotation.expiresAt && new Date() > quotation.expiresAt) {
            await this.prisma.quotation.update({
                where: { id: quotationId },
                data: { status: 'expired' },
            });
            return { ...quotation, status: 'expired' as const };
        }

        return quotation;
    }

    // Buyer: list my quotations
    async getMyQuotations(buyerId: string) {
        const carts = await this.prisma.intendedCart.findMany({
            where: { userId: buyerId },
            select: { id: true },
        });

        const cartIds = carts.map((c) => c.id);

        return this.prisma.quotation.findMany({
            where: { cartId: { in: cartIds } },
            include: {
                items: {
                    include: {
                        cartItem: {
                            include: {
                                recommendationItem: {
                                    include: { inventorySku: true },
                                },
                            },
                        },
                    },
                },
                cart: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // Cron: expire old quotations
    async expireOldQuotations() {
        const now = new Date();
        const expired = await this.prisma.quotation.findMany({
            where: {
                status: 'sent',
                expiresAt: { lt: now },
            },
            include: { cart: true },
        });

        for (const q of expired) {
            await this.prisma.quotation.update({
                where: { id: q.id },
                data: { status: 'expired' },
            });

            if (q.cart?.userId) {
                await this.notifications.notifyQuoteExpired(q.cart.userId, q.id);
            }
        }

        return { expired: expired.length };
    }
}
