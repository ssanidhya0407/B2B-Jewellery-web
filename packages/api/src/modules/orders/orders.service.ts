import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CommissionsService } from '../commissions/commissions.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
    constructor(
        private prisma: PrismaService,
        private notifications: NotificationsService,
        private commissions: CommissionsService,
    ) { }

    private async autoForwardToOpsAfterPaymentValidation(orderId: string, actorId?: string | null) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                payments: true,
                quotation: { select: { cartId: true } },
            },
        });
        if (!order) throw new NotFoundException('Order not found');

        const total = Number(order.totalAmount || 0);
        const paidAmount = Number(order.paidAmount || 0);
        const isFullyPaid = total > 0 ? paidAmount >= total : false;
        const paidRecord = order.payments?.find((p) => ['paid', 'completed'].includes((p.status || '').toLowerCase()));
        const paymentConfirmedAt = order.paymentConfirmedAt || (isFullyPaid ? (paidRecord?.paidAt || paidRecord?.createdAt || null) : null);
        if (!paymentConfirmedAt) {
            return { order, autoForwarded: false, alreadyForwarded: false };
        }

        const alreadyForwarded = Boolean(order.forwardedToOpsAt)
            || ['confirmed', 'in_procurement', 'shipped', 'partially_shipped', 'delivered', 'partially_delivered'].includes((order.status || '').toLowerCase());
        if (alreadyForwarded) {
            return { order, autoForwarded: false, alreadyForwarded: true };
        }

        const now = new Date();
        const updated = await this.prisma.order.update({
            where: { id: order.id },
            data: {
                status: 'confirmed',
                forwardedToOpsAt: now,
                forwardedToOpsById: actorId || order.salesPersonId || null,
            },
            include: {
                quotation: { select: { cartId: true } },
            },
        });

        const opsUsers = await this.prisma.user.findMany({
            where: { userType: 'operations', isActive: true },
            select: { id: true },
        });

        if (opsUsers.length > 0) {
            await this.prisma.notification.createMany({
                data: opsUsers.map((u) => ({
                    userId: u.id,
                    type: 'ops_fulfillment_ready',
                    title: 'Order Ready for Processing',
                    message: `Paid order #${updated.orderNumber} is ready for fulfillment.`,
                    link: '/ops/orders',
                })),
            });
        }

        if (updated.quotation?.cartId) {
            await this.prisma.message.create({
                data: {
                    cartId: updated.quotation.cartId,
                    senderId: actorId || order.salesPersonId || order.buyerId,
                    content: '[System] FORWARDED_TO_OPS_FOR_FULFILLMENT',
                },
            }).catch(() => null);
        }

        return { order: updated, autoForwarded: true, alreadyForwarded: false };
    }

    private withInferredOrderWorkflow<T extends {
        status: string;
        paidAmount?: number | { toString(): string } | null;
        totalAmount?: number | { toString(): string } | null;
        opsFinalCheckStatus?: string | null;
        paymentLinkSentAt?: Date | null;
        paymentConfirmedAt?: Date | null;
        forwardedToOpsAt?: Date | null;
        payments?: Array<{ status?: string; paidAt?: Date | null; createdAt?: Date }>;
    }>(order: T): T {
        const total = Number(order.totalAmount || 0);
        const paid = Number(order.paidAmount || 0);
        const isFullyPaid = total > 0 ? paid >= total : false;
        const paidRecord = order.payments?.find((p) => ['paid', 'completed'].includes((p.status || '').toLowerCase()));
        const paymentConfirmedAt = order.paymentConfirmedAt || (isFullyPaid ? (paidRecord?.paidAt || paidRecord?.createdAt || null) : null);
        const forwardedToOpsAt = order.forwardedToOpsAt
            || (['confirmed', 'in_procurement', 'shipped', 'partially_shipped', 'delivered', 'partially_delivered'].includes((order.status || '').toLowerCase())
                ? new Date()
                : null);
        return {
            ...order,
            opsFinalCheckStatus: order.opsFinalCheckStatus || (order.paymentLinkSentAt || paymentConfirmedAt || forwardedToOpsAt ? 'approved' : 'pending'),
            paymentConfirmedAt,
            forwardedToOpsAt,
        };
    }

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
        const normalizedStatus = (quotation.status || '').toLowerCase();
        const canAcceptStatuses = new Set(['sent', 'negotiating', 'final', 'final_offer']);
        if (!canAcceptStatuses.has(normalizedStatus)) {
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
                    opsFinalCheckStatus: 'pending',
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

        // Calculate commission
        try {
            await this.commissions.calculateCommission(order.id);
        } catch (err) {
            console.error('Failed to calculate commission:', err);
        }

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
        const normalizedStatus = (quotation.status || '').toLowerCase();
        const canRejectStatuses = new Set(['sent', 'negotiating', 'final', 'final_offer']);
        if (!canRejectStatuses.has(normalizedStatus)) {
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

    // Buyer: revised offer (counter-offer)
    async counterOffer(quotationId: string, buyerId: string, items: Array<{ cartItemId: string; finalUnitPrice: number }>) {
        const quotation = await this.prisma.quotation.findUnique({
            where: { id: quotationId },
            include: { cart: true },
        });

        if (!quotation) throw new NotFoundException('Quotation not found');
        if (quotation.cart.userId !== buyerId) {
            throw new BadRequestException('This quotation is not for you');
        }
        if (quotation.status !== 'sent') {
            throw new BadRequestException('A counter-offer can only be submitted once on the initial quote.');
        }

        // Generate sequential quotation number: QT-YYYY-NNN
        const year = new Date().getFullYear();
        const prefix = `QT-${year}-`;

        let newQuotationId = '';

        await this.prisma.$transaction(async (tx) => {
            const lastQuotation = await tx.quotation.findFirst({
                where: { quotationNumber: { startsWith: prefix } },
                orderBy: { quotationNumber: 'desc' },
                select: { quotationNumber: true },
            });

            let nextSeq = 1;
            if (lastQuotation?.quotationNumber) {
                const seqPart = lastQuotation.quotationNumber.replace(prefix, '');
                nextSeq = parseInt(seqPart, 10) + 1;
            }
            const newQuotationNumber = `${prefix}${nextSeq.toString().padStart(4, '0')}`;

            const cartItems = await tx.cartItem.findMany({
                where: { cartId: quotation.cartId },
            });

            const quotationItems = items.map((item) => {
                const cartItem = cartItems.find((ci) => ci.id === item.cartItemId);
                const quantity = cartItem?.quantity || 1;
                return {
                    cartItemId: item.cartItemId,
                    finalUnitPrice: item.finalUnitPrice,
                    quantity,
                    lineTotal: new Prisma.Decimal(item.finalUnitPrice).mul(quantity),
                };
            });

            const quotedTotal = quotationItems.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0));

            const newQuotation = await tx.quotation.create({
                data: {
                    cartId: quotation.cartId,
                    createdById: quotation.createdById, // the sales rep remains the owner
                    quotationNumber: newQuotationNumber,
                    quotedTotal,
                    validUntil: quotation.validUntil,
                    status: 'countered',
                    terms: quotation.terms,
                    items: {
                        create: quotationItems.map(qi => ({
                            cartItemId: qi.cartItemId,
                            finalUnitPrice: qi.finalUnitPrice,
                            quantity: qi.quantity,
                            lineTotal: qi.lineTotal
                        })),
                    }
                }
            });

            newQuotationId = newQuotation.id;

            // Log this counter offer so the tracker picks it up
            const oldTotal = Number(quotation.quotedTotal || 0);
            const newTotal = Number(quotedTotal || 0);
            const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

            await tx.message.create({
                data: {
                    cartId: quotation.cartId,
                    content: `[System] Buyer submitted a counter-offer: ${fmt(oldTotal)} → ${fmt(newTotal)}`,
                    senderId: buyerId,
                }
            });
        });

        return this.getQuotationForBuyer(quotationId, buyerId);
    }

    // Buyer: get my orders
    async getMyOrders(buyerId: string) {
        const orders = await this.prisma.order.findMany({
            where: { buyerId },
            include: {
                items: {
                    include: {
                        quotationItem: {
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
                    },
                },
                quotation: true,
                payments: true,
                shipments: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return orders.map((o) => this.withInferredOrderWorkflow(o));
    }

    // Buyer: get single order
    async getOrder(orderId: string, buyerId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    include: {
                        quotationItem: {
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
                    },
                },
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

        return this.withInferredOrderWorkflow(order);
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
        const opsFinalStatus = (order.opsFinalCheckStatus || '').toLowerCase();
        if (opsFinalStatus !== 'approved') {
            throw new BadRequestException('Ops final check approval is required before payment');
        }
        if (!order.paymentLinkSentAt) {
            throw new BadRequestException('Payment link has not been sent by sales yet');
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
                const isFullyPaid = newPaidAmount >= totalAmount;
                const newStatus = isFullyPaid ? 'confirmed' : 'pending_payment';

                await tx.order.update({
                    where: { id: orderId },
                    data: {
                        paidAmount: newPaidAmount,
                        status: newStatus,
                        paymentConfirmedAt: isFullyPaid ? new Date() : undefined,
                        paymentConfirmationSource: data.method === 'upi' || data.method === 'card' ? 'payment_gateway' : undefined,
                    },
                });
            });

            await this.notifications.notifyPaymentReceived(buyerId, orderId, order.orderNumber);
            await this.autoForwardToOpsAfterPaymentValidation(orderId, order.salesPersonId || null);
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
                orders: {
                    include: { payments: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
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

        return {
            ...quotation,
            orders: quotation.orders.map((o) => this.withInferredOrderWorkflow(o)),
        };
    }

    // Buyer: list my quotations
    async getMyQuotations(buyerId: string) {
        const carts = await this.prisma.intendedCart.findMany({
            where: { userId: buyerId },
            select: { id: true },
        });

        const cartIds = carts.map((c) => c.id);

        const quotations = await this.prisma.quotation.findMany({
            where: { cartId: { in: cartIds } },
            include: {
                items: {
                    include: {
                        cartItem: {
                            include: {
                                recommendationItem: {
                                    include: { inventorySku: true, manufacturerItem: true },
                                },
                            },
                        },
                    },
                },
                cart: true,
                orders: {
                    include: { payments: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return quotations.map((q) => ({
            ...q,
            orders: q.orders.map((o) => this.withInferredOrderWorkflow(o)),
        }));
    }

    // Buyer: get messages for a quotation/cart
    async getQuotationMessages(cartId: string, buyerId: string) {
        const cart = await this.prisma.intendedCart.findUnique({
            where: { id: cartId },
            select: { userId: true },
        });
        if (!cart) throw new NotFoundException('Cart not found');
        if (cart.userId !== buyerId) throw new BadRequestException('Not authorized');

        return this.prisma.message.findMany({
            where: { cartId },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, userType: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    // Buyer: send message
    async sendQuotationMessage(cartId: string, buyerId: string, content: string) {
        const cart = await this.prisma.intendedCart.findUnique({
            where: { id: cartId },
            select: { userId: true },
        });
        if (!cart) throw new NotFoundException('Cart not found');
        if (cart.userId !== buyerId) throw new BadRequestException('Not authorized');

        return this.prisma.message.create({
            data: { cartId, senderId: buyerId, content },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, userType: true } },
            },
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
