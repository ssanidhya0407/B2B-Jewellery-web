import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NegotiationStatus, UserType } from '@prisma/client';

@Injectable()
export class NegotiationsService {
    constructor(private prisma: PrismaService) { }

    /**
     * Sales/admin opens negotiation on a SENT quotation.
     * Creates round 0 with the original quotation prices as the starting point.
     */
    async openNegotiation(quotationId: string, openedById: string, note?: string) {
        const quotation = await this.prisma.quotation.findUnique({
            where: { id: quotationId },
            include: { items: true, negotiation: true },
        });

        if (!quotation) throw new NotFoundException('Quotation not found');
        if (quotation.status !== 'sent') {
            throw new BadRequestException('Negotiation can only be opened on a sent quotation');
        }
        if (quotation.negotiation) {
            throw new BadRequestException('Negotiation already exists for this quotation');
        }

        // Create negotiation with round 0 = original quotation prices
        const negotiation = await this.prisma.negotiation.create({
            data: {
                quotationId,
                openedById,
                status: NegotiationStatus.open,
                note,
                rounds: {
                    create: {
                        roundNumber: 0,
                        proposedById: openedById,
                        proposedTotal: quotation.quotedTotal!,
                        message: 'Original quotation prices — open for negotiation.',
                        items: {
                            create: quotation.items.map((item) => ({
                                cartItemId: item.cartItemId,
                                proposedUnitPrice: item.finalUnitPrice,
                                quantity: item.quantity,
                                lineTotal: item.lineTotal,
                            })),
                        },
                    },
                },
            },
            include: {
                rounds: { include: { items: true, proposedBy: { select: { id: true, firstName: true, lastName: true, userType: true } } } },
                openedBy: { select: { id: true, firstName: true, lastName: true, userType: true } },
                quotation: { include: { items: { include: { cartItem: { include: { recommendationItem: { include: { inventorySku: true, manufacturerItem: true } } } } } } } },
            },
        });

        return negotiation;
    }

    /**
     * Get negotiation by quotation ID with all rounds.
     */
    async getByQuotationId(quotationId: string) {
        const negotiation = await this.prisma.negotiation.findUnique({
            where: { quotationId },
            include: {
                rounds: {
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
                        proposedBy: { select: { id: true, firstName: true, lastName: true, userType: true } },
                    },
                    orderBy: { roundNumber: 'asc' },
                },
                openedBy: { select: { id: true, firstName: true, lastName: true, userType: true } },
                quotation: {
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
                    },
                },
            },
        });

        if (!negotiation) throw new NotFoundException('Negotiation not found');
        return negotiation;
    }

    /**
     * Get negotiation by its own ID.
     */
    async getById(negotiationId: string) {
        const negotiation = await this.prisma.negotiation.findUnique({
            where: { id: negotiationId },
            include: {
                rounds: {
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
                        proposedBy: { select: { id: true, firstName: true, lastName: true, userType: true } },
                    },
                    orderBy: { roundNumber: 'asc' },
                },
                openedBy: { select: { id: true, firstName: true, lastName: true, userType: true } },
                quotation: {
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
                    },
                },
            },
        });

        if (!negotiation) throw new NotFoundException('Negotiation not found');
        return negotiation;
    }

    /**
     * Submit a counter-offer (new round). 
     * Buyer or sales can counter-offer depending on whose turn it is.
     */
    async submitCounterOffer(
        negotiationId: string,
        proposedById: string,
        userType: UserType,
        data: {
            items: Array<{ cartItemId: string; proposedUnitPrice: number; quantity: number }>;
            message?: string;
        },
    ) {
        const negotiation = await this.prisma.negotiation.findUnique({
            where: { id: negotiationId },
            include: {
                rounds: { orderBy: { roundNumber: 'desc' }, take: 1 },
                quotation: { include: { cart: true } },
            },
        });

        if (!negotiation) throw new NotFoundException('Negotiation not found');
        if (negotiation.status === 'accepted' || negotiation.status === 'rejected' || negotiation.status === 'closed') {
            throw new BadRequestException('Negotiation is no longer active');
        }

        // Validate turn: after round 0 (seller), buyer counters, then seller, etc.
        const lastRound = negotiation.rounds[0];
        const isBuyer = userType === UserType.external;
        const isSeller = userType === UserType.sales || userType === UserType.admin || userType === UserType.operations;

        if (isBuyer && negotiation.quotation.cart.userId !== proposedById) {
            throw new ForbiddenException('You can only negotiate on your own quotations');
        }

        // Check whose turn — open/counter_seller means buyer's turn, counter_buyer means seller's turn
        if (isBuyer && negotiation.status === 'counter_buyer') {
            throw new BadRequestException('Waiting for seller to respond');
        }
        if (isSeller && negotiation.status === 'counter_seller') {
            throw new BadRequestException('Waiting for buyer to respond');
        }

        const newRoundNumber = (lastRound?.roundNumber ?? -1) + 1;

        const items = data.items.map((item) => ({
            cartItemId: item.cartItemId,
            proposedUnitPrice: item.proposedUnitPrice,
            quantity: item.quantity,
            lineTotal: item.proposedUnitPrice * item.quantity,
        }));

        const proposedTotal = items.reduce((sum, i) => sum + i.lineTotal, 0);

        const newStatus = isBuyer ? NegotiationStatus.counter_buyer : NegotiationStatus.counter_seller;

        const updated = await this.prisma.negotiation.update({
            where: { id: negotiationId },
            data: {
                status: newStatus,
                rounds: {
                    create: {
                        roundNumber: newRoundNumber,
                        proposedById,
                        proposedTotal,
                        message: data.message,
                        items: { create: items },
                    },
                },
            },
            include: {
                rounds: {
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
                        proposedBy: { select: { id: true, firstName: true, lastName: true, userType: true } },
                    },
                    orderBy: { roundNumber: 'asc' },
                },
                openedBy: { select: { id: true, firstName: true, lastName: true, userType: true } },
                quotation: { include: { items: true, cart: true } },
            },
        });

        return updated;
    }

    /**
     * Accept the current negotiation prices. Either side can accept.
     * If seller accepts, the quotation is updated with new prices.
     */
    async acceptNegotiation(negotiationId: string, userId: string, userType: UserType) {
        const negotiation = await this.prisma.negotiation.findUnique({
            where: { id: negotiationId },
            include: {
                rounds: {
                    orderBy: { roundNumber: 'desc' },
                    take: 1,
                    include: { items: true },
                },
                quotation: { include: { cart: true } },
            },
        });

        if (!negotiation) throw new NotFoundException('Negotiation not found');
        if (negotiation.status === 'accepted' || negotiation.status === 'rejected' || negotiation.status === 'closed') {
            throw new BadRequestException('Negotiation is no longer active');
        }

        const isBuyer = userType === UserType.external;
        if (isBuyer && negotiation.quotation.cart.userId !== userId) {
            throw new ForbiddenException('You can only accept your own negotiations');
        }

        const lastRound = negotiation.rounds[0];
        if (!lastRound) throw new BadRequestException('No rounds to accept');

        // Update the quotation with accepted prices
        await this.prisma.$transaction(async (tx) => {
            // Update negotiation status
            await tx.negotiation.update({
                where: { id: negotiationId },
                data: { status: NegotiationStatus.accepted },
            });

            // Update quotation items with final negotiated prices
            for (const item of lastRound.items) {
                await tx.quotationItem.updateMany({
                    where: {
                        quotationId: negotiation.quotationId,
                        cartItemId: item.cartItemId,
                    },
                    data: {
                        finalUnitPrice: item.proposedUnitPrice,
                        quantity: item.quantity,
                        lineTotal: item.lineTotal,
                    },
                });
            }

            // Update quotation total
            await tx.quotation.update({
                where: { id: negotiation.quotationId },
                data: {
                    quotedTotal: lastRound.proposedTotal,
                    status: 'sent', // keep as sent so buyer can still accept the quotation
                },
            });
        });

        return this.getById(negotiationId);
    }

    /**
     * Reject/close the negotiation. Quotation stays as-is.
     */
    async closeNegotiation(negotiationId: string, userId: string, userType: UserType, reason?: string) {
        const negotiation = await this.prisma.negotiation.findUnique({
            where: { id: negotiationId },
            include: { quotation: { include: { cart: true } } },
        });

        if (!negotiation) throw new NotFoundException('Negotiation not found');
        if (negotiation.status === 'accepted' || negotiation.status === 'rejected' || negotiation.status === 'closed') {
            throw new BadRequestException('Negotiation is already closed');
        }

        const isBuyer = userType === UserType.external;
        if (isBuyer && negotiation.quotation.cart.userId !== userId) {
            throw new ForbiddenException('Not authorized');
        }

        await this.prisma.negotiation.update({
            where: { id: negotiationId },
            data: {
                status: NegotiationStatus.closed,
                note: reason || negotiation.note,
            },
        });

        return this.getById(negotiationId);
    }

    /**
     * Get negotiation for a buyer's quotation (buyer endpoint).
     */
    async getForBuyer(quotationId: string, userId: string) {
        const quotation = await this.prisma.quotation.findUnique({
            where: { id: quotationId },
            include: { cart: true },
        });

        if (!quotation) throw new NotFoundException('Quotation not found');
        if (quotation.cart.userId !== userId) {
            throw new ForbiddenException('Not your quotation');
        }

        const negotiation = await this.prisma.negotiation.findUnique({
            where: { quotationId },
        });

        if (!negotiation) return null; // no negotiation opened yet

        return this.getById(negotiation.id);
    }
}
