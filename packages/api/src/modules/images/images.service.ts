import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ImagesService {
    constructor(private readonly prisma: PrismaService) {}

    async createSession(userId: string, payload: { category?: string; context?: string; maxUnitPrice?: number; imageUrl?: string }) {
        const session = await this.prisma.imageSession.create({
            data: {
                userId,
                selectedCategory: (payload.category as any) || 'other',
                originalImageUrl: payload.imageUrl || '/product-images/other-01.jpg',
                thumbnailUrl: payload.imageUrl || '/product-images/other-01.jpg',
                sessionStatus: 'analyzed',
                userContext: payload.context || null,
                maxUnitPrice: payload.maxUnitPrice ?? null,
                geminiAttributes: {
                    detectedCategory: payload.category || 'other',
                    inferredFrom: 'upload',
                },
            },
        });
        return { sessionId: session.id };
    }

    async suggestFeatures(payload: { category?: string; context?: string }) {
        const category = payload.category || 'other';
        return {
            attributes: {
                category,
                style: 'modern',
                setting: 'classic',
                colorTone: 'gold',
                context: payload.context || '',
            },
            features: ['center-stone', 'metal-band', 'ornamental-detail'],
        };
    }

    async getSession(sessionId: string, userId: string) {
        const session = await this.prisma.imageSession.findFirst({ where: { id: sessionId, userId } });
        if (!session) throw new NotFoundException('Session not found');
        return session;
    }

    async getSessions(userId: string) {
        return this.prisma.imageSession.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getSessionEmbedding(sessionId: string): Promise<number[] | null> {
        const row = await this.prisma.$queryRawUnsafe<Array<{ embedding_text: string | null }>>(
            `SELECT embedding::text as embedding_text FROM image_embeddings WHERE image_session_id = $1 LIMIT 1`,
            sessionId,
        ).catch(() => []);

        const text = row?.[0]?.embedding_text;
        if (!text) return null;
        const cleaned = text.replace(/^\[/, '').replace(/\]$/, '');
        if (!cleaned.trim()) return null;
        const values = cleaned.split(',').map((v) => Number(v.trim())).filter((v) => Number.isFinite(v));
        return values.length ? values : null;
    }
}
