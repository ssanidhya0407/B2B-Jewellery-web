import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        super({
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    /**
     * Execute raw SQL for vector similarity search
     */
    async searchByEmbedding(
        tableName: 'inventory_skus' | 'manufacturer_catalog' | 'design_patterns',
        embedding: number[],
        limit: number = 5,
        minSimilarity: number = 0.0,
    ): Promise<
        Array<{
            id: string;
            similarity: number;
            [key: string]: unknown;
        }>
    > {
        const vectorString = `[${embedding.join(',')}]`;

        const results = await this.$queryRawUnsafe<
            Array<{
                id: string;
                similarity: number;
                [key: string]: unknown;
            }>
        >(
            `
      SELECT 
        *,
        1 - (embedding <=> $1::vector) as similarity
      FROM ${tableName}
      WHERE embedding IS NOT NULL
        AND is_active = true
        AND 1 - (embedding <=> $1::vector) >= $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
      `,
            vectorString,
            minSimilarity,
            limit,
        );

        return results;
    }
}
