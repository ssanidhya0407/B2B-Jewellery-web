import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class InventoryService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(options: { category?: string; limit: number; offset: number }) {
        const where = {
            isActive: true,
            ...(options.category && { category: options.category }),
        };

        const [items, total] = await Promise.all([
            this.prisma.inventorySku.findMany({
                where,
                take: options.limit,
                skip: options.offset,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    skuCode: true,
                    name: true,
                    description: true,
                    category: true,
                    primaryMetal: true,
                    stoneTypes: true,
                    baseCost: true,
                    moq: true,
                    leadTimeDays: true,
                    availableQuantity: true,
                    imageUrl: true,
                },
            }),
            this.prisma.inventorySku.count({ where }),
        ]);

        return {
            items,
            total,
            limit: options.limit,
            offset: options.offset,
        };
    }

    async findById(id: string) {
        return this.prisma.inventorySku.findUnique({
            where: { id },
        });
    }

    async getCategories() {
        const categories = await this.prisma.inventorySku.groupBy({
            by: ['category'],
            where: { isActive: true },
            _count: { category: true },
        });

        return categories.map((c) => ({
            name: c.category,
            count: c._count.category,
        }));
    }
}
