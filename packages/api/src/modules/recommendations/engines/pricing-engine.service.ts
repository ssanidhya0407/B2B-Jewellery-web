import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

interface PriceRange {
    min: number;
    max: number;
}

interface MarginConfig {
    marginPercentage: number;
    minMarkup?: number;
    maxMarkup?: number;
}

@Injectable()
export class PricingEngineService {
    // Default margin configurations
    private readonly DEFAULT_INVENTORY_MARGIN = 35; // 35%
    private readonly DEFAULT_MANUFACTURER_MARGIN = 45; // 45%
    private readonly MANUFACTURER_BUFFER = 10; // Negotiation / volatility buffer for external quotes

    constructor(private readonly prisma: PrismaService) { }

    async calculateDisplayPrice(
        sourceType: 'inventory' | 'manufacturer',
        costs: { baseCost?: number; baseCostMin?: number; baseCostMax?: number },
        category?: string,
    ): Promise<PriceRange> {
        // Get margin configuration from database (or use defaults)
        const marginConfig = await this.getMarginConfig(sourceType, category);

        if (sourceType === 'inventory') {
            const baseCost = costs.baseCost || 0;
            const price = this.applyMargin(baseCost, marginConfig);
            return {
                min: Math.round(price),
                max: Math.round(price),
            };
        } else {
            // Manufacturer pricing - wider range with buffers
            const minCost = costs.baseCostMin || 0;
            const maxCost = costs.baseCostMax || minCost;

            // Apply buffers for manufacturer items
            const bufferMultiplier = 1 + this.MANUFACTURER_BUFFER / 100;
            const adjustedMin = minCost * bufferMultiplier;
            const adjustedMax = maxCost * bufferMultiplier;

            return {
                min: Math.round(this.applyMargin(adjustedMin, marginConfig)),
                max: Math.round(this.applyMargin(adjustedMax, marginConfig)),
            };
        }
    }

    private applyMargin(baseCost: number, config: MarginConfig): number {
        // Markup formula (as per product requirements):
        // baseCost × (1 + markupPercentage)
        let markup = baseCost * (config.marginPercentage / 100);

        // Apply min/max markup constraints
        if (config.minMarkup !== undefined && markup < config.minMarkup) {
            markup = config.minMarkup;
        }

        if (config.maxMarkup !== undefined && markup > config.maxMarkup) {
            markup = config.maxMarkup;
        }

        return baseCost + markup;
    }

    private async getMarginConfig(
        sourceType: 'inventory' | 'manufacturer',
        category?: string,
    ): Promise<MarginConfig> {
        try {
            const lookups: Array<{ sourceType?: string | null; category?: string | null }> = [
                ...(category ? [{ sourceType, category }] : []),
                ...(category ? [{ sourceType: null, category }] : []),
                { sourceType, category: null },
                { sourceType: null, category: null },
            ];

            for (const lookup of lookups) {
                const config = await this.prisma.marginConfiguration.findFirst({
                    where: {
                        isActive: true,
                        ...(lookup.sourceType !== undefined && { sourceType: lookup.sourceType }),
                        ...(lookup.category !== undefined && { category: lookup.category }),
                    },
                    orderBy: { createdAt: 'desc' },
                });

                if (config) {
                    return {
                        marginPercentage: Number(config.marginPercentage),
                        minMarkup: config.minMarkup !== null && config.minMarkup !== undefined ? Number(config.minMarkup) : undefined,
                        maxMarkup: config.maxMarkup !== null && config.maxMarkup !== undefined ? Number(config.maxMarkup) : undefined,
                    };
                }
            }
        } catch {
            // If table doesn't exist or query fails, use defaults
        }

        // Return default configuration
        return {
            marginPercentage:
                sourceType === 'inventory'
                    ? this.DEFAULT_INVENTORY_MARGIN
                    : this.DEFAULT_MANUFACTURER_MARGIN,
        };
    }

    /**
     * Calculate price for quotation (final confirmed pricing)
     */
    async calculateQuotationPrice(
        items: Array<{
            sourceType: 'inventory' | 'manufacturer';
            baseCost: number;
            quantity: number;
        }>,
    ): Promise<{
        items: Array<{ unitPrice: number; lineTotal: number }>;
        subtotal: number;
        total: number;
    }> {
        const pricedItems = await Promise.all(
            items.map(async (item) => {
                const marginConfig = await this.getMarginConfig(item.sourceType);
                const unitPrice = Math.round(this.applyMargin(item.baseCost, marginConfig));
                return {
                    unitPrice,
                    lineTotal: unitPrice * item.quantity,
                };
            }),
        );

        const subtotal = pricedItems.reduce((sum, item) => sum + item.lineTotal, 0);

        return {
            items: pricedItems,
            subtotal,
            total: subtotal, // Can add tax, shipping etc. here
        };
    }
}
