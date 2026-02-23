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

        if (!quotation || quotation.status !== 'draft') {
            throw new BadRequestException('Quotation cannot be modified');
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
            await this.prisma.quotation.update({
                where: { id: quotationId },
                data: { quotedTotal },
            });
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
        });

        if (!quotation) {
            throw new NotFoundException('Quotation not found');
        }

        if (quotation.status !== 'draft') {
            throw new BadRequestException('Only draft quotations can be sent');
        }

        // Set expiry: validUntil if already set, otherwise 30 days from now
        const expiresAt = quotation.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Update quotation status with sentAt and expiresAt
        await this.prisma.quotation.update({
            where: { id: quotationId },
            data: {
                status: 'sent',
                sentAt: new Date(),
                expiresAt,
            },
        });

        // Update cart status
        await this.prisma.intendedCart.update({
            where: { id: quotation.cartId },
            data: { status: 'quoted' },
        });

        // In production, send email notification here

        return { success: true, message: 'Quotation sent to customer' };
    }
}
