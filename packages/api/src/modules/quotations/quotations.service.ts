// Triggering re-analysis after Prisma client sync
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CartStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class QuotationsService {
    constructor(private readonly prisma: PrismaService) { }

    async getSubmittedRequests() {
        return this.prisma.intendedCart.findMany({
            where: {
                status: { in: ['submitted', 'under_review', 'quoted'] },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        companyName: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                session: {
                    select: {
                        thumbnailUrl: true,
                        geminiAttributes: true,
                    },
                },
                items: {
                    include: {
                        recommendationItem: {
                            include: {
                                inventorySku: true,
                                manufacturerItem: true,
                            },
                        },
                    },
                },
                quotations: true,
                assignedSales: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                validatedByOps: {
                    select: { id: true, firstName: true, lastName: true },
                },
            },
            orderBy: { submittedAt: 'desc' },
        });
    }

    async getRequestDetails(cartId: string) {
        const cart = await this.prisma.intendedCart.findUnique({
            where: { id: cartId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        companyName: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                    },
                },
                session: {
                    select: {
                        id: true,
                        thumbnailUrl: true,
                        geminiAttributes: true,
                        selectedCategory: true,
                        maxUnitPrice: true,
                        createdAt: true,
                    },
                },
                items: {
                    include: {
                        recommendationItem: {
                            include: {
                                inventorySku: true,
                                manufacturerItem: true,
                            },
                        },
                    },
                },
                quotations: {
                    include: {
                        items: true,
                        createdBy: {
                            select: { firstName: true, lastName: true, email: true },
                        },
                    },
                },
                assignedSales: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                validatedByOps: {
                    select: { id: true, firstName: true, lastName: true },
                },
            },
        });

        if (!cart) {
            throw new NotFoundException('Request not found');
        }

        return cart;
    }

    async updateRequestStatus(cartId: string, status: string) {
        const validStatuses: CartStatus[] = ['submitted', 'under_review', 'quoted', 'closed'];

        if (!validStatuses.includes(status as CartStatus)) {
            throw new BadRequestException('Invalid status');
        }

        return this.prisma.intendedCart.update({
            where: { id: cartId },
            data: { status: status as CartStatus },
        });
    }

    async create(
        cartId: string,
        items: Array<{ cartItemId: string; finalUnitPrice: number }>,
        createdById: string,
    ) {
        // Generate quotation number: QT-YYYY-NNN
        const quotationNumber = await this.generateQuotationNumber();

        // Get cart items to calculate totals
        const cartItems = await this.prisma.cartItem.findMany({
            where: { cartId },
        });

        const quotationItems = items.map((item) => {
            const cartItem = cartItems.find((ci) => ci.id === item.cartItemId);
            const quantity = cartItem?.quantity || 1;
            return {
                cartItemId: item.cartItemId,
                finalUnitPrice: item.finalUnitPrice,
                quantity,
                lineTotal: item.finalUnitPrice * quantity,
            };
        });

        const quotedTotal = quotationItems.reduce((sum, item) => sum + item.lineTotal, 0);

        // Set validity to 30 days
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 30);

        return this.prisma.quotation.create({
            data: {
                cartId,
                createdById,
                quotationNumber,
                quotedTotal,
                validUntil,
                status: 'draft',
                items: {
                    create: quotationItems,
                },
            },
            include: { items: true },
        });
    }

    /**
     * Generate sequential quotation number: QT-2025-001, QT-2025-002, etc.
     */
    private async generateQuotationNumber(): Promise<string> {
        const year = new Date().getFullYear();
        const prefix = `QT-${year}-`;

        const lastQuotation = await this.prisma.quotation.findFirst({
            where: {
                quotationNumber: { startsWith: prefix },
            },
            orderBy: { quotationNumber: 'desc' },
            select: { quotationNumber: true },
        });

        let nextSeq = 1;
        if (lastQuotation?.quotationNumber) {
            const seqPart = lastQuotation.quotationNumber.replace(prefix, '');
            nextSeq = parseInt(seqPart, 10) + 1;
        }

        return `${prefix}${nextSeq.toString().padStart(4, '0')}`;
    }

    async update(
        quotationId: string,
        data: { items?: Array<{ cartItemId: string; finalUnitPrice: number }>; terms?: string },
    ) {
        const quotation = await this.prisma.quotation.findUnique({
            where: { id: quotationId },
        });

        if (!quotation || !['draft', 'sent', 'negotiating', 'countered'].includes(quotation.status)) {
            throw new BadRequestException('Quotation cannot be modified in its current state');
        }

        if (data.items) {
            // Delete existing items and recreate
            await this.prisma.quotationItem.deleteMany({
                where: { quotationId },
            });

            const cartItems = await this.prisma.cartItem.findMany({
                where: { cartId: quotation.cartId },
            });

            const quotationItems = data.items.map((item) => {
                const cartItem = cartItems.find((ci) => ci.id === item.cartItemId);
                const quantity = cartItem?.quantity || 1;
                return {
                    quotationId,
                    cartItemId: item.cartItemId,
                    finalUnitPrice: item.finalUnitPrice,
                    quantity,
                    lineTotal: item.finalUnitPrice * quantity,
                };
            });

            await this.prisma.quotationItem.createMany({
                data: quotationItems,
            });

            const quotedTotal = quotationItems.reduce((sum, item) => sum + item.lineTotal, 0);

            // If the quote was countered by the buyer, the sales rep's update becomes the final 'negotiating' (final) price.
            const newStatus = quotation.status === 'countered' ? 'negotiating' : quotation.status;

            await this.prisma.quotation.update({
                where: { id: quotationId },
                data: { quotedTotal, status: newStatus as any },
            });

            // If it was already sent/negotiating/countered, log this update so the tracker picks it up
            if (quotation.status !== 'draft') {
                const oldTotal = Number(quotation.quotedTotal || 0);
                const newTotal = quotedTotal;
                const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

                const prefix = quotation.status === 'countered' ? '[System] Sales provided final quotation:' : '[System] Sales adjusted quotation:';

                await this.prisma.message.create({
                    data: {
                        cartId: quotation.cartId,
                        content: `${prefix} ${fmt(oldTotal)} → ${fmt(newTotal)}`,
                        senderId: quotation.createdById,
                    }
                });
            }
        }

        if (data.terms !== undefined) {
            await this.prisma.quotation.update({
                where: { id: quotationId },
                data: { terms: data.terms },
            });
        }

        return this.prisma.quotation.findUnique({
            where: { id: quotationId },
            include: { items: true },
        });
    }

    async send(quotationId: string) {
        const quotation = await this.prisma.quotation.findUnique({
            where: { id: quotationId },
            include: { cart: { include: { quotations: { orderBy: { createdAt: 'desc' }, take: 2 } } } }
        });

        if (!quotation) {
            throw new NotFoundException('Quotation not found');
        }

        if (quotation.status !== 'draft') {
            throw new BadRequestException('Only draft quotations can be sent');
        }

        // Check if there's a previous quotation that was countered
        const previousQuotation = quotation.cart?.quotations.find(q => q.id !== quotationId);
        const finalStatus = previousQuotation?.status === 'countered' ? 'negotiating' : 'sent';

        // Set expiry: validUntil if already set, otherwise 30 days from now
        const expiresAt = quotation.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Update quotation status with sentAt and expiresAt
        await this.prisma.quotation.update({
            where: { id: quotationId },
            data: {
                status: finalStatus as any,
                sentAt: new Date(),
                expiresAt,
            },
        });

        // Also log a system message
        if (finalStatus === 'negotiating') {
            const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
            await this.prisma.message.create({
                data: {
                    cartId: quotation.cartId,
                    content: `[System] Sales provided final quotation: ${fmt(Number(quotation.quotedTotal || 0))}`,
                    senderId: quotation.createdById,
                }
            });
        }

        // Update cart status
        await this.prisma.intendedCart.update({
            where: { id: quotation.cartId },
            data: { status: 'quoted' },
        });

        // In production, send email notification here

        return { success: true, message: 'Quotation sent to customer' };
    }
}
