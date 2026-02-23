import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface InventoryMatch {
    id: string;
    skuCode: string;
    name: string;
    description: string | null;
    category: string;
    primaryMetal: string | null;
    stoneTypes: string[];
    baseCost: number;
    moq: number;
    leadTimeDays: number | null;
    imageUrl: string;
    similarity: number;
}

@Injectable()
export class InventoryMatcherService {
    constructor(private readonly prisma: PrismaService) { }

    async findMatches(
        embedding: number[],
        limit: number = 5,
        minSimilarity: number = 0.3,
        category?: string,
    ): Promise<InventoryMatch[]> {
        const vectorString = `[${embedding.join(',')}]`;

        const results = await this.prisma.$queryRawUnsafe<
            Array<{
                id: string;
                sku_code: string;
                name: string;
                description: string | null;
                category: string;
                primary_metal: string | null;
                stone_types: string[];
                base_cost: string;
                moq: number;
                lead_time_days: number | null;
                image_url: string;
                similarity: number;
            }>
        >(
            `
      SELECT 
        id,
        sku_code,
        name,
        description,
        category,
        primary_metal,
        stone_types,
        base_cost::text,
        moq,
        lead_time_days,
        image_url,
        1 - (embedding <=> $1::vector) as similarity
      FROM inventory_skus
      WHERE embedding IS NOT NULL
        AND is_active = true
        AND (
          $4::text IS NULL
          OR category = $4
          OR ($4 = 'earring' AND category = 'earrings')
          OR ($4 = 'bangle' AND category = 'bangles')
        )
        AND 1 - (embedding <=> $1::vector) >= $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
      `,
            vectorString,
            minSimilarity,
            limit,
            category ?? null,
        );

        return results.map((r) => ({
            id: r.id,
            skuCode: r.sku_code,
            name: r.name,
            description: r.description,
            category: r.category,
            primaryMetal: r.primary_metal,
            stoneTypes: r.stone_types || [],
            baseCost: parseFloat(r.base_cost),
            moq: r.moq,
            leadTimeDays: r.lead_time_days,
            imageUrl: r.image_url,
            similarity: r.similarity,
        }));
    }
}
