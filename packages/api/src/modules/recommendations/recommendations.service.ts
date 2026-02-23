import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ImagesService } from '../images/images.service';
import { InventoryMatcherService, type InventoryMatch } from './engines/inventory-matcher.service';
import { ManufacturerMatcherService, type ManufacturerMatch } from './engines/manufacturer-matcher.service';
import { PricingEngineService } from './engines/pricing-engine.service';

const EXACT_MATCH_THRESHOLD = 0.95;
const DEFAULT_ALTERNATIVES_COUNT = 7; // total tiles = 1 primary + 7 alternatives

type InventoryCandidate = InventoryMatch & { sourceType: 'inventory' };
type ManufacturerCandidate = ManufacturerMatch & { sourceType: 'manufacturer' };
type MatchCandidate = InventoryCandidate | ManufacturerCandidate;

interface RecommendationTile {
    id: string;
    sourceType: 'inventory' | 'manufacturer';
    isPrimary: boolean;
    matchQuality: 'exact' | 'similar';
    attributeMatches: Record<string, boolean>;
    imageUrl: string;
    name: string;
    description?: string;
    material: string;
    priceRange: { min: number; max: number };
    moq: number;
    leadTime: string;
    similarityScore: number;
    availableQuantity: number;
    stoneTypes: string[];
    style?: string;
    skuCode?: string;
    qualityTier?: string;
    category: string;
}

@Injectable()
export class RecommendationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly imagesService: ImagesService,
        private readonly inventoryMatcher: InventoryMatcherService,
        private readonly manufacturerMatcher: ManufacturerMatcherService,
        private readonly pricingEngine: PricingEngineService,
    ) { }

    async getRecommendations(sessionId: string, userId: string) {
        // Check session exists and belongs to user
        const session = await this.prisma.imageSession.findFirst({
            where: { id: sessionId, userId },
            include: {
                recommendationSet: {
                    include: {
                        items: {
                            include: {
                                inventorySku: true,
                                manufacturerItem: true,
                            },
                            orderBy: [{ isPrimary: 'desc' }, { similarityScore: 'desc' }],
                        },
                    },
                },
            },
        });

        if (!session) {
            throw new NotFoundException('Session not found');
        }

        // If recommendations already exist, return them
        if (session.recommendationSet) {
            return {
                sessionId,
                status: 'ready',
                selectedCategory: session.selectedCategory,
                maxUnitPrice: session.maxUnitPrice ? Number(session.maxUnitPrice) : null,
                attributes: session.geminiAttributes,
                recommendations: this.formatRecommendations(session, session.recommendationSet.items),
            };
        }

        // Check if session is ready for recommendations
        if (session.sessionStatus !== 'recommendations_ready' && session.sessionStatus !== 'analyzed') {
            return {
                sessionId,
                status: session.sessionStatus,
                attributes: session.geminiAttributes,
                recommendations: [],
            };
        }

        // Generate recommendations
        return this.generateRecommendations(session);
    }

    async regenerateRecommendations(sessionId: string, userId: string) {
        const session = await this.prisma.imageSession.findFirst({
            where: { id: sessionId, userId },
        });

        if (!session) {
            throw new NotFoundException('Session not found');
        }

        // Delete existing recommendation set
        await this.prisma.recommendationSet.deleteMany({
            where: { sessionId },
        });

        return this.generateRecommendations(session);
    }

    private async generateRecommendations(session: { id: string; selectedCategory: string; maxUnitPrice: unknown; geminiAttributes: unknown }) {
        const sessionId = session.id;

        // Get session embedding
        const embedding = await this.imagesService.getSessionEmbedding(sessionId);

        if (!embedding) {
            throw new BadRequestException('Session embedding not yet available');
        }

        const selectedCategory = session.selectedCategory;
        const maxUnitPrice = session.maxUnitPrice ? Number(session.maxUnitPrice) : undefined;

        // STEP 1: Search internal inventory (ALWAYS PRIORITIZED)
        const inventoryMatches = await this.inventoryMatcher.findMatches(
            embedding,
            12,
            0.3,
            selectedCategory,
        );

        // STEP 2: Search manufacturer catalog (Alibaba/marketplace fallback)
        // Fetch extra results so we can apply maxUnitPrice filtering later.
        const manufacturerMatchesRaw = await this.manufacturerMatcher.findMatches(
            embedding,
            30,
            0.2,
            selectedCategory,
        );

        // Apply maxUnitPrice filtering for manufacturer items (buyer constraint)
        const manufacturerMatches = maxUnitPrice
            ? (await this.filterManufacturerByMaxUnitPrice(
                manufacturerMatchesRaw,
                selectedCategory,
                maxUnitPrice,
            ))
            : manufacturerMatchesRaw;

        // STEP 3: Determine primary and alternatives (tiered logic)
        let primaryMatch: MatchCandidate | null = null;
        let alternatives: MatchCandidate[] = [];

        const bestInventory = inventoryMatches[0];
        const hasExactInventoryMatch = Boolean(bestInventory && bestInventory.similarity >= EXACT_MATCH_THRESHOLD);

        if (hasExactInventoryMatch) {
            // Tier 1: Exact match from internal inventory (>95%)
            primaryMatch = { ...bestInventory, sourceType: 'inventory' as const };

            const inventoryAlts: InventoryCandidate[] = inventoryMatches
                .slice(1)
                .map((m) => ({ ...m, sourceType: 'inventory' as const }));
            const manufacturerAlts: ManufacturerCandidate[] = manufacturerMatches
                .slice(0)
                .map((m) => ({ ...m, sourceType: 'manufacturer' as const }));

            alternatives = this.pickAlternatives(primaryMatch.id, [
                ...inventoryAlts,
                ...manufacturerAlts,
            ], DEFAULT_ALTERNATIVES_COUNT);
        } else if (manufacturerMatches.length > 0) {
            // Tier 2: External sourcing (Alibaba/marketplace) if no internal exact match
            primaryMatch = { ...manufacturerMatches[0], sourceType: 'manufacturer' as const };

            const inventoryAlts: InventoryCandidate[] = inventoryMatches
                .slice(0)
                .map((m) => ({ ...m, sourceType: 'inventory' as const }));
            const manufacturerAlts: ManufacturerCandidate[] = manufacturerMatches
                .slice(1)
                .map((m) => ({ ...m, sourceType: 'manufacturer' as const }));

            alternatives = this.pickAlternatives(primaryMatch.id, [
                ...inventoryAlts,
                ...manufacturerAlts,
            ], DEFAULT_ALTERNATIVES_COUNT);
        } else if (inventoryMatches.length > 0) {
            // Tier 3 fallback: show closest internal alternatives even if not "exact"
            primaryMatch = { ...inventoryMatches[0], sourceType: 'inventory' as const };
            const inventoryAlts: InventoryCandidate[] = inventoryMatches
                .slice(1)
                .map((m) => ({ ...m, sourceType: 'inventory' as const }));
            alternatives = this.pickAlternatives(primaryMatch.id, inventoryAlts, DEFAULT_ALTERNATIVES_COUNT);
        }

        if (!primaryMatch) {
            return {
                sessionId,
                status: 'no_matches',
                attributes: null,
                recommendations: [],
            };
        }

        // STEP 4: Create recommendation set with pricing
        const recommendationSet = await this.prisma.recommendationSet.create({
            data: {
                sessionId,
                items: {
                    create: [
                        await this.createRecommendationItem(primaryMatch, true, selectedCategory),
                        ...await Promise.all(alternatives.map((alt) => this.createRecommendationItem(alt, false, selectedCategory))),
                    ],
                },
            },
            include: {
                items: {
                    include: {
                        inventorySku: true,
                        manufacturerItem: true,
                    },
                    orderBy: [{ isPrimary: 'desc' }, { similarityScore: 'desc' }],
                },
            },
        });

        return {
            sessionId,
            status: 'ready',
            selectedCategory,
            maxUnitPrice: maxUnitPrice ?? null,
            attributes: session.geminiAttributes,
            recommendations: this.formatRecommendations(
                { ...session, selectedCategory },
                recommendationSet.items,
            ),
        };
    }

    private pickAlternatives<T extends { id: string }>(
        primaryId: string,
        candidates: T[],
        limit: number,
    ): T[] {
        const unique = candidates.filter((c) => c.id !== primaryId);
        const seen = new Set<string>();
        const picked: T[] = [];
        for (const item of unique) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            picked.push(item);
            if (picked.length >= limit) break;
        }
        return picked;
    }

    private async filterManufacturerByMaxUnitPrice(
        matches: ManufacturerMatch[],
        category: string,
        maxUnitPrice: number,
    ) {
        const filtered: ManufacturerMatch[] = [];
        for (const match of matches) {
            const pricing = await this.pricingEngine.calculateDisplayPrice(
                'manufacturer',
                {
                    baseCostMin: Number(match.baseCostMin || 0),
                    baseCostMax: Number(match.baseCostMax || 0),
                },
                category,
            );
            if (pricing.max <= maxUnitPrice) {
                filtered.push(match);
            }
            if (filtered.length >= 12) break;
        }
        return filtered;
    }

    private async createRecommendationItem(
        match: MatchCandidate,
        isPrimary: boolean,
        category: string,
    ) {
        const pricing = await this.pricingEngine.calculateDisplayPrice(
            match.sourceType,
            match.sourceType === 'inventory'
                ? { baseCost: Number(match.baseCost || 0) }
                : {
                    baseCostMin: Number(match.baseCostMin || 0),
                    baseCostMax: Number(match.baseCostMax || 0),
                },
            category,
        );

        return {
            sourceType: match.sourceType,
            inventorySkuId: match.sourceType === 'inventory' ? match.id : null,
            manufacturerItemId: match.sourceType === 'manufacturer' ? match.id : null,
            isPrimary,
            similarityScore: match.similarity,
            displayPriceMin: pricing.min,
            displayPriceMax: pricing.max,
            displayMoq: Number(match.moq || 1),
            displayLeadTime: match.leadTimeDays ? `${match.leadTimeDays} days` : '14-21 days',
        };
    }

    private formatRecommendations(
        session: { selectedCategory: string; geminiAttributes: unknown },
        items: Array<{
            id: string;
            sourceType: string;
            isPrimary: boolean;
            similarityScore: unknown;
            displayPriceMin: unknown;
            displayPriceMax: unknown;
            displayMoq: number | null;
            displayLeadTime: string | null;
            inventorySku: {
                imageUrl: string;
                name: string;
                description: string | null;
                primaryMetal: string | null;
                category?: string;
                stoneTypes?: string[];
            } | null;
            manufacturerItem: {
                imageUrl: string | null;
                name: string;
                description: string | null;
                primaryMetal: string | null;
                category?: string;
                stoneTypes?: string[];
            } | null;
        }>,
    ): RecommendationTile[] {
        const extracted = session.geminiAttributes as Record<string, unknown> | null;
        const selectedCategory = session.selectedCategory;
        const extractedMetal = typeof extracted?.metal_type === 'string' ? extracted.metal_type : null;
        const extractedGemstones = Array.isArray(extracted?.gemstone_types) ? extracted?.gemstone_types as string[] : [];

        return items.map((item) => {
            const source = item.inventorySku || item.manufacturerItem;
            const sourceCategory = (source as any)?.category as string | undefined;
            const sourceMetal = (source as any)?.primaryMetal as string | null | undefined;
            const sourceStones = ((source as any)?.stoneTypes as string[] | undefined) || [];

            const categoryMatch = !sourceCategory || sourceCategory === selectedCategory;
            const metalMatch = this.isMetalMatch(extractedMetal, sourceMetal);
            const stonesMatch = this.isStoneMatch(extractedGemstones, sourceStones);

            return {
                id: item.id,
                sourceType: item.sourceType as 'inventory' | 'manufacturer',
                isPrimary: item.isPrimary,
                matchQuality:
                    item.sourceType === 'inventory' && Number(item.similarityScore) >= EXACT_MATCH_THRESHOLD
                        ? 'exact'
                        : 'similar',
                attributeMatches: {
                    category: categoryMatch,
                    metal: metalMatch,
                    gemstones: stonesMatch,
                },
                imageUrl: source?.imageUrl || '',
                name: source?.name || 'Unknown Product',
                description: source?.description || undefined,
                material: source?.primaryMetal || 'Mixed metals',
                priceRange: {
                    min: Number(item.displayPriceMin) || 0,
                    max: Number(item.displayPriceMax) || 0,
                },
                moq: item.displayMoq || 1,
                leadTime: item.displayLeadTime || '14-21 days',
                similarityScore: Number(item.similarityScore) || 0,
                availableQuantity: (item.inventorySku as any)?.availableQuantity ?? 0,
                stoneTypes: sourceStones,
                style: (source as any)?.style || undefined,
                skuCode: (item.inventorySku as any)?.skuCode || undefined,
                qualityTier: (source as any)?.qualityTier || undefined,
                category: sourceCategory || selectedCategory,
            };
        });
    }

    private isMetalMatch(extractedMetalType: string | null, skuPrimaryMetal: string | null | undefined): boolean {
        if (!extractedMetalType || !skuPrimaryMetal) return false;

        const metal = skuPrimaryMetal.toLowerCase();
        if (extractedMetalType === 'gold') return metal.includes('gold') && !metal.includes('rose');
        if (extractedMetalType === 'rose_gold') return metal.includes('rose');
        if (extractedMetalType === 'silver') return metal.includes('silver');
        if (extractedMetalType === 'platinum') return metal.includes('platinum');
        if (extractedMetalType === 'mixed') return metal.includes('mixed');
        return false;
    }

    private isStoneMatch(extracted: string[], skuStones: string[]): boolean {
        if (extracted.length === 0 && skuStones.length === 0) return true;
        if (extracted.length === 0 || skuStones.length === 0) return false;

        const a = new Set(extracted.map((s) => s.toLowerCase()));
        for (const stone of skuStones) {
            if (a.has(stone.toLowerCase())) return true;
        }
        return false;
    }
}
