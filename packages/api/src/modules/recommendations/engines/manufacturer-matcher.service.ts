import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface ManufacturerMatch {
    id: string;
    name: string;
    description: string | null;
    category: string;
    primaryMetal: string | null;
    stoneTypes: string[];
    baseCostMin: number;
    baseCostMax: number;
    moq: number;
    leadTimeDays: number | null;
    imageUrl: string | null;
    qualityTier: string;
    similarity: number;
}

@Injectable()
export class ManufacturerMatcherService {
    constructor(private readonly prisma: PrismaService) { }

    async findMatches(
        embedding: number[],
        limit: number = 5,
        minSimilarity: number = 0.2,
        category?: string,
    ): Promise<ManufacturerMatch[]> {
        const vectorString = `[${embedding.join(',')}]`;

        try {
            const results = await this.prisma.$queryRawUnsafe<
                Array<{
                    id: string;
                    name: string;
                    description: string | null;
                    category: string;
                    primary_metal: string | null;
                    stone_types: string[];
                    base_cost_min: string | null;
                    base_cost_max: string | null;
                    moq: number;
                    lead_time_days: number | null;
                    image_url: string | null;
                    quality_tier: string;
                    similarity: number;
                }>
            >(
                `
        SELECT 
          id,
          name,
          description,
          category,
          primary_metal,
          stone_types,
          base_cost_min::text,
          base_cost_max::text,
          moq,
          lead_time_days,
          image_url,
          quality_tier,
          1 - (embedding <=> $1::vector) as similarity
        FROM manufacturer_catalog
        WHERE embedding IS NOT NULL
          AND is_verified = true
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
                name: r.name,
                description: r.description,
                category: r.category,
                primaryMetal: r.primary_metal,
                stoneTypes: r.stone_types || [],
                baseCostMin: parseFloat(r.base_cost_min || '0'),
                baseCostMax: parseFloat(r.base_cost_max || '0'),
                moq: r.moq,
                leadTimeDays: r.lead_time_days,
                imageUrl: r.image_url,
                qualityTier: r.quality_tier,
                similarity: r.similarity,
            }));
        } catch {
            // Return empty array if table is empty or query fails
            console.log('Manufacturer catalog query returned no results');
            return [];
        }
    }

    /**
     * Mock Alibaba manufacturer search for demonstration
     * In production, this would query actual Alibaba data
     */
    async searchAlibabaProducts(
        attributes: Record<string, unknown>,
        limit: number = 5,
    ): Promise<ManufacturerMatch[]> {
        // This is a mock implementation
        // In production, integrate with Alibaba API or scraped data
        const mockProducts: ManufacturerMatch[] = [
            {
                id: 'mock-1',
                name: 'Gold Plated Ring',
                description: 'Elegant gold plated ring with cubic zirconia',
                category: 'ring',
                primaryMetal: 'yellow_gold',
                stoneTypes: ['cubic_zirconia'],
                baseCostMin: 15,
                baseCostMax: 25,
                moq: 50,
                leadTimeDays: 21,
                imageUrl: null,
                qualityTier: 'standard',
                similarity: 0.75,
            },
            {
                id: 'mock-2',
                name: 'Silver Necklace Chain',
                description: 'Sterling silver chain necklace',
                category: 'necklace',
                primaryMetal: 'silver',
                stoneTypes: [],
                baseCostMin: 8,
                baseCostMax: 15,
                moq: 100,
                leadTimeDays: 14,
                imageUrl: null,
                qualityTier: 'standard',
                similarity: 0.65,
            },
        ];

        return mockProducts.slice(0, limit);
    }
}
