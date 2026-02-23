// Jewellery Categories
export const JEWELLERY_CATEGORIES = [
    'ring',
    'necklace',
    'earring',
    'bracelet',
    'pendant',
    'bangle',
    'other',
] as const;

export const JEWELLERY_CATEGORY_ALIASES: Record<string, typeof JEWELLERY_CATEGORIES[number]> = {
    earrings: 'earring',
};

// Metal Types
export const METAL_TYPES = [
    'yellow_gold',
    'white_gold',
    'rose_gold',
    'silver',
    'platinum',
    'mixed',
    'unknown',
] as const;

// Visual metal types extracted from buyer uploads
export const VISUAL_METAL_TYPES = [
    'gold',
    'silver',
    'platinum',
    'rose_gold',
    'mixed',
    'unknown',
] as const;

export const DESIGN_STYLE_TYPES = [
    'vintage',
    'modern',
    'ethnic',
    'minimalist',
    'statement',
    'other',
] as const;

export const CRAFTSMANSHIP_DETAILS = [
    'filigree',
    'engraved',
    'plain',
    'textured',
    'other',
] as const;

export const PATTERN_TYPES = [
    'floral',
    'geometric',
    'abstract',
    'other',
] as const;

export const STONE_SETTING_STYLES = [
    'prong',
    'bezel',
    'pave',
    'channel',
    'none',
    'other',
    'unknown',
] as const;

// Stone Presence Levels
export const STONE_PRESENCE = ['none', 'low', 'medium', 'high'] as const;

// Stone Types
export const STONE_TYPES = [
    'diamond',
    'sapphire',
    'ruby',
    'emerald',
    'pearl',
    'cubic_zirconia',
    'other',
] as const;

// Shape Types
export const SHAPE_TYPES = [
    'geometric',
    'floral',
    'organic',
    'abstract',
    'figurative',
    'traditional',
] as const;

// Style Types
export const STYLE_TYPES = [
    'minimalist',
    'vintage',
    'modern',
    'bohemian',
    'luxury',
    'bridal',
] as const;

// Complexity Levels
export const COMPLEXITY_LEVELS = ['simple', 'medium', 'complex'] as const;

// User Types
export const USER_TYPES = ['external', 'sales', 'sourcing', 'admin'] as const;

// Cart Statuses
export const CART_STATUSES = [
    'draft',
    'submitted',
    'under_review',
    'quoted',
    'closed',
] as const;

// Session Statuses
export const SESSION_STATUSES = [
    'processing',
    'analyzed',
    'recommendations_ready',
    'failed',
] as const;

// Source Types
export const SOURCE_TYPES = ['inventory', 'manufacturer'] as const;

// API Configuration
export const API_CONFIG = {
    MAX_IMAGE_SIZE_MB: 10,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    EMBEDDING_DIMENSION: 512,
    EXACT_MATCH_THRESHOLD: 0.95,
    SIMILARITY_THRESHOLD: 0.75,
    MAX_RECOMMENDATIONS: 8,
    DEFAULT_MOQ: 1,
    DEFAULT_LEAD_TIME_DAYS: 14,
} as const;

// Pricing Configuration
export const PRICING_CONFIG = {
    DEFAULT_MARGIN_PERCENTAGE: 35,
    MIN_MARGIN_PERCENTAGE: 15,
    MAX_MARGIN_PERCENTAGE: 100,
    MANUFACTURER_BUFFER_PERCENTAGE: 10,
    OPERATIONAL_OVERHEAD_PERCENTAGE: 5,
} as const;
