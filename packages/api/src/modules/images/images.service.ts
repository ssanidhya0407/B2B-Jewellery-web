import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { JewelleryCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { HfVisionService } from './processors/hf-vision.service';
import { STORAGE_SERVICE, StorageService } from './storage.constants';
import sharp from 'sharp';

function normalizeSelectedCategory(category: string): JewelleryCategory {
    if (category === 'earrings') return JewelleryCategory.earring;
    if (
        category === JewelleryCategory.ring ||
        category === JewelleryCategory.necklace ||
        category === JewelleryCategory.earring ||
        category === JewelleryCategory.bracelet ||
        category === JewelleryCategory.pendant ||
        category === JewelleryCategory.bangle ||
        category === JewelleryCategory.other
    ) {
        return category;
    }
    return JewelleryCategory.other;
}

@Injectable()
export class ImagesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly hfVision: HfVisionService,
        @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    ) { }

    async processUpload(
        file: Express.Multer.File,
        userId: string,
        selectedCategory: string,
        maxUnitPrice?: number,
        userContext?: string,
    ) {
        const normalizedCategory = normalizeSelectedCategory(selectedCategory);

        // 1. Upload image + thumbnail
        const { imageUrl, thumbnailUrl } = await this.storage.uploadImage(
            file.buffer,
            file.mimetype,
        );

        // 2. Create session in processing state
        const session = await this.prisma.imageSession.create({
            data: {
                userId,
                selectedCategory: normalizedCategory,
                originalImageUrl: imageUrl,
                thumbnailUrl,
                sessionStatus: 'processing',
                ...(maxUnitPrice !== undefined && { maxUnitPrice }),
                userContext,
            },
        });

        // 3. Process with Gemini Vision (async - don't await)
        const aiBuffer = await sharp(file.buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

        this.processWithVision(session.id, aiBuffer, normalizedCategory, userContext).catch((error) => {
            console.error(`Failed to process image for session ${session.id}:`, error);
            this.updateSessionStatus(session.id, 'failed');
        });

        return session;
    }

    private async processWithVision(
        sessionId: string,
        imageBuffer: Buffer,
        selectedCategory: JewelleryCategory,
        userContext?: string,
    ) {
        try {
            // Extract attributes using Hugging Face Vision
            const attributes = await this.hfVision.analyzeImage(
                imageBuffer,
                selectedCategory,
                userContext,
            );

            // Generate embedding
            const embedding = await this.hfVision.generateEmbeddingFromAttributes(attributes);

            // Update session with attributes
            await this.prisma.imageSession.update({
                where: { id: sessionId },
                data: {
                    geminiAttributes: attributes as unknown as Prisma.InputJsonValue,
                    sessionStatus: 'analyzed',
                },
            });

            // Store embedding
            if (embedding && embedding.length > 0) {
                const vectorString = `[${embedding.join(',')}]`;
                await this.prisma.$executeRawUnsafe(
                    `INSERT INTO image_embeddings (id, image_session_id, embedding, created_at)
           VALUES (gen_random_uuid(), $1::uuid, $2::vector, NOW())`,
                    sessionId,
                    vectorString,
                );
            }

            // Update status to ready for recommendations
            await this.prisma.imageSession.update({
                where: { id: sessionId },
                data: { sessionStatus: 'recommendations_ready' },
            });
        } catch (error) {
            console.error('Gemini processing error:', error);
            await this.updateSessionStatus(sessionId, 'failed');
            throw error;
        }
    }

    private async updateSessionStatus(
        sessionId: string,
        status: 'processing' | 'analyzed' | 'recommendations_ready' | 'failed',
    ) {
        await this.prisma.imageSession.update({
            where: { id: sessionId },
            data: { sessionStatus: status },
        });
    }

    async getSessionWithDetails(sessionId: string, userId: string) {
        const session = await this.prisma.imageSession.findFirst({
            where: {
                id: sessionId,
                userId,
            },
            include: {
                recommendationSet: {
                    include: {
                        items: {
                            include: {
                                inventorySku: true,
                                manufacturerItem: true,
                            },
                        },
                    },
                },
            },
        });

        if (!session) {
            throw new NotFoundException('Session not found');
        }

        return session;
    }

    async getUserSessions(userId: string) {
        return this.prisma.imageSession.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
                id: true,
                thumbnailUrl: true,
                sessionStatus: true,
                geminiAttributes: true,
                createdAt: true,
            },
        });
    }

    async getSessionEmbedding(sessionId: string): Promise<number[] | null> {
        const result = await this.prisma.$queryRaw<
            Array<{ embedding: string }>
        >`SELECT embedding::text FROM image_embeddings WHERE image_session_id = ${sessionId}::uuid`;

        if (result.length === 0) {
            return null;
        }

        // Parse vector string to array
        const vectorStr = result[0].embedding;
        return JSON.parse(vectorStr.replace('[', '[').replace(']', ']'));
    }
}
