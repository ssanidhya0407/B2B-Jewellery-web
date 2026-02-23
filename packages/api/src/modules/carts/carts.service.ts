import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCartDto, AddCartItemDto, UpdateCartItemDto, SubmitCartDto } from './dto';

@Injectable()
export class CartsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(userId: string, dto: CreateCartDto) {
        return this.prisma.intendedCart.create({
            data: {
                userId,
                sessionId: dto.sessionId,
                notes: dto.notes,
                status: 'draft',
            },
        });
    }

    /**
     * Returns the user's current draft cart, or creates one if none exists.
     * This is the "global wishlist" cart that items from any session can be added to.
     */
    async getOrCreateDraftCart(userId: string) {
        let cart = await this.prisma.intendedCart.findFirst({
            where: { userId, status: 'draft' },
            include: {
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
                session: {
                    select: {
                        thumbnailUrl: true,
                        geminiAttributes: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!cart) {
            cart = await this.prisma.intendedCart.create({
                data: { userId, status: 'draft' },
                include: {
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
                    session: {
                        select: {
                            thumbnailUrl: true,
                            geminiAttributes: true,
                        },
                    },
                },
            });
        }

        return cart;
    }

    async findUserCarts(userId: string) {
        return this.prisma.intendedCart.findMany({
            where: { userId },
            include: {
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
                session: {
                    select: {
                        thumbnailUrl: true,
                        geminiAttributes: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findById(cartId: string, userId: string) {
        const cart = await this.prisma.intendedCart.findFirst({
            where: { id: cartId, userId },
            include: {
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
                session: true,
                quotations: true,
            },
        });

        if (!cart) {
            throw new NotFoundException('Cart not found');
        }

        return cart;
    }

    async addItem(cartId: string, userId: string, dto: AddCartItemDto) {
        const cart = await this.ensureCartEditable(cartId, userId);

        return this.prisma.cartItem.create({
            data: {
                cartId: cart.id,
                recommendationItemId: dto.recommendationItemId,
                quantity: dto.quantity || 1,
                itemNotes: dto.notes,
            },
            include: {
                recommendationItem: {
                    include: {
                        inventorySku: true,
                        manufacturerItem: true,
                    },
                },
            },
        });
    }

    async updateItem(
        cartId: string,
        itemId: string,
        userId: string,
        dto: UpdateCartItemDto,
    ) {
        await this.ensureCartEditable(cartId, userId);

        return this.prisma.cartItem.update({
            where: { id: itemId },
            data: {
                ...(dto.quantity !== undefined && { quantity: dto.quantity }),
                ...(dto.notes !== undefined && { itemNotes: dto.notes }),
            },
        });
    }

    async removeItem(cartId: string, itemId: string, userId: string) {
        await this.ensureCartEditable(cartId, userId);

        await this.prisma.cartItem.delete({
            where: { id: itemId },
        });

        return { success: true };
    }

    async submit(cartId: string, userId: string, dto?: SubmitCartDto) {
        const cart = await this.ensureCartEditable(cartId, userId);

        // Verify cart has items
        const itemCount = await this.prisma.cartItem.count({
            where: { cartId },
        });

        if (itemCount === 0) {
            throw new BadRequestException('Cannot submit an empty cart');
        }

        // Build notes from additional details
        const notesParts: string[] = [];
        if (cart.notes) notesParts.push(cart.notes);
        if (dto?.preferredDeliveryDate) notesParts.push(`Preferred delivery: ${dto.preferredDeliveryDate}`);
        if (dto?.customizationRequirements) notesParts.push(`Customization: ${dto.customizationRequirements}`);
        if (dto?.businessUseCase) notesParts.push(`Use case: ${dto.businessUseCase}`);
        if (dto?.urgency) notesParts.push(`Urgency: ${dto.urgency}`);
        if (dto?.additionalNotes) notesParts.push(`Notes: ${dto.additionalNotes}`);

        return this.prisma.intendedCart.update({
            where: { id: cart.id },
            data: {
                status: 'submitted',
                submittedAt: new Date(),
                notes: notesParts.length > 0 ? notesParts.join('\n---\n') : cart.notes,
            },
        });
    }

    private async ensureCartEditable(cartId: string, userId: string) {
        const cart = await this.prisma.intendedCart.findFirst({
            where: { id: cartId, userId },
        });

        if (!cart) {
            throw new NotFoundException('Cart not found');
        }

        if (cart.status !== 'draft') {
            throw new BadRequestException('Cart cannot be modified after submission');
        }

        return cart;
    }
}
