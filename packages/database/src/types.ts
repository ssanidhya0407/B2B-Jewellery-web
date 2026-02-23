// Re-export Prisma types for use across the monorepo
export type {
    User,
    UserType,
    ImageSession,
    SessionStatus,
    ImageEmbedding,
    InventorySku,
    ManufacturerCatalog,
    DesignPattern,
    RecommendationSet,
    RecommendationItem,
    SourceType,
    IntendedCart,
    CartStatus,
    CartItem,
    Quotation,
    QuotationStatus,
    QuotationItem,
    MarginConfiguration,
} from '@prisma/client';

// Custom types for API responses

export interface JewelleryAttributes {
    /**
     * Category comes from user selection and must be treated as source-of-truth.
     * The AI must not override it.
     */
    selected_category: 'ring' | 'necklace' | 'earring' | 'bracelet' | 'pendant' | 'bangle' | 'other';

    // Visual attributes (AI-extracted)
    metal_type: 'gold' | 'silver' | 'platinum' | 'rose_gold' | 'mixed' | 'unknown';
    gemstone_types: string[];
    gemstone_colors?: string[];
    design_style: 'vintage' | 'modern' | 'ethnic' | 'minimalist' | 'statement' | 'other';
    craftsmanship_details: Array<'filigree' | 'engraved' | 'plain' | 'textured' | 'other'>;
    pattern_type: 'floral' | 'geometric' | 'abstract' | 'other';
    stone_setting_style: 'prong' | 'bezel' | 'pave' | 'channel' | 'none' | 'other' | 'unknown';

    // Optional extra signals (implementation-specific)
    confidence?: Record<string, number>;
}

export interface RecommendationTile {
    id: string;
    imageUrl: string;
    name: string;
    description?: string;
    material: string;
    priceRange: {
        min: number;
        max: number;
        currency: string;
    };
    moq: number;
    leadTime: string;
    sourceType: 'inventory' | 'manufacturer';
    isPrimary: boolean;
    similarityScore: number;
}

export interface RecommendationResponse {
    sessionId: string;
    status: 'processing' | 'ready' | 'failed';
    attributes?: JewelleryAttributes;
    recommendations: RecommendationTile[];
}

export interface CartItemResponse {
    id: string;
    recommendation: RecommendationTile;
    quantity: number;
    notes?: string;
    addedAt: Date;
}

export interface CartResponse {
    id: string;
    status: 'draft' | 'submitted' | 'under_review' | 'quoted' | 'closed';
    items: CartItemResponse[];
    notes?: string;
    createdAt: Date;
    submittedAt?: Date;
}
