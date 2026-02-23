import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HfInference } from '@huggingface/inference';

/* ── Attribute types (identical to the old Gemini service) ── */
interface ExtractedJewelleryAttributes {
    selected_category:
    | 'ring'
    | 'necklace'
    | 'earring'
    | 'bracelet'
    | 'pendant'
    | 'bangle'
    | 'other';

    metal_type: 'gold' | 'silver' | 'platinum' | 'rose_gold' | 'mixed' | 'unknown';
    gemstone_types: string[];
    gemstone_colors?: string[];
    design_style: 'vintage' | 'modern' | 'ethnic' | 'minimalist' | 'statement' | 'other';
    craftsmanship_details: Array<'filigree' | 'engraved' | 'plain' | 'textured' | 'other'>;
    pattern_type: 'floral' | 'geometric' | 'abstract' | 'other';
    stone_setting_style: 'prong' | 'bezel' | 'pave' | 'channel' | 'none' | 'other' | 'unknown';
    confidence?: Record<string, number>;
}

type Category = ExtractedJewelleryAttributes['selected_category'];

function normalizeSelectedCategory(category: string): Category {
    const map: Record<string, Category> = {
        earrings: 'earring', rings: 'ring', necklaces: 'necklace',
        bracelets: 'bracelet', pendants: 'pendant', bangles: 'bangle',
        ring: 'ring', necklace: 'necklace', earring: 'earring',
        bracelet: 'bracelet', pendant: 'pendant', bangle: 'bangle',
        other: 'other',
    };
    return map[category] || 'other';
}

/* ── Keyword dictionaries for caption parsing ── */

const METAL_KEYWORDS: Record<string, ExtractedJewelleryAttributes['metal_type']> = {
    'gold': 'gold', 'golden': 'gold', 'yellow gold': 'gold',
    'silver': 'silver', 'sterling': 'silver',
    'platinum': 'platinum', 'white gold': 'platinum',
    'rose gold': 'rose_gold', 'rose': 'rose_gold', 'pink gold': 'rose_gold',
};

const GEMSTONE_KEYWORDS: string[] = [
    'diamond', 'ruby', 'sapphire', 'emerald', 'topaz', 'amethyst',
    'opal', 'pearl', 'garnet', 'turquoise', 'aquamarine', 'tanzanite',
    'zirconia', 'cubic zirconia', 'crystal', 'stone', 'gem', 'gemstone',
];

const COLOR_KEYWORDS: string[] = [
    'red', 'blue', 'green', 'clear', 'white', 'black', 'pink',
    'purple', 'yellow', 'orange', 'multicolor',
];

const STYLE_KEYWORDS: Record<string, ExtractedJewelleryAttributes['design_style']> = {
    'vintage': 'vintage', 'antique': 'vintage', 'retro': 'vintage', 'classic': 'vintage',
    'modern': 'modern', 'contemporary': 'modern', 'sleek': 'modern', 'tennis': 'modern',
    'ethnic': 'ethnic', 'tribal': 'ethnic', 'traditional': 'ethnic', 'indian': 'ethnic', 'jhumka': 'ethnic', 'temple': 'ethnic',
    'minimalist': 'minimalist', 'simple': 'minimalist', 'delicate': 'minimalist',
    'statement': 'statement', 'bold': 'statement', 'large': 'statement', 'chunky': 'statement', 'chain': 'statement', 'link': 'statement',
};

const CRAFT_KEYWORDS: Record<string, 'filigree' | 'engraved' | 'plain' | 'textured' | 'other'> = {
    'filigree': 'filigree', 'intricate': 'filigree', 'lace': 'filigree',
    'engraved': 'engraved', 'carved': 'engraved', 'etched': 'engraved',
    'plain': 'plain', 'smooth': 'plain', 'polished': 'plain',
    'textured': 'textured', 'hammered': 'textured', 'brushed': 'textured',
};

const PATTERN_KEYWORDS: Record<string, ExtractedJewelleryAttributes['pattern_type']> = {
    'floral': 'floral', 'flower': 'floral', 'leaf': 'floral', 'vine': 'floral',
    'geometric': 'geometric', 'angular': 'geometric', 'square': 'geometric', 'hexagonal': 'geometric',
    'abstract': 'abstract', 'swirl': 'abstract', 'wave': 'abstract',
};

const SETTING_KEYWORDS: Record<string, ExtractedJewelleryAttributes['stone_setting_style']> = {
    'prong': 'prong', 'claw': 'prong', 'solitaire': 'prong',
    'bezel': 'bezel', 'flush': 'bezel',
    'pave': 'pave', 'pavé': 'pave', 'micro pave': 'pave',
    'channel': 'channel',
};

@Injectable()
export class HfVisionService {
    private hf: HfInference | null = null;

    constructor(private readonly configService: ConfigService) {
        const token = this.configService.get<string>('hf.apiToken');
        if (token) {
            this.hf = new HfInference(token);
            console.log('✅ Hugging Face Inference API initialised');
        } else {
            console.warn('⚠️  HF_API_TOKEN not set — using mock attributes + random embeddings');
        }
    }

    /* ────────────────────────────────────
     * 1) IMAGE → STRUCTURED ATTRIBUTES
     * ──────────────────────────────────── */
    async analyzeImage(
        imageBuffer: Buffer,
        selectedCategory: string,
        _userContext?: string,
    ): Promise<ExtractedJewelleryAttributes> {
        const normalizedCategory = normalizeSelectedCategory(selectedCategory);

        if (!this.hf) {
            return this.getMockAttributes(normalizedCategory);
        }

        try {
            // Use BLIP image-to-text for captioning
            const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' });
            const captionResult = await this.hf.imageToText({
                model: 'Salesforce/blip-image-captioning-large',
                data: blob,
            });

            const caption = (captionResult?.generated_text || '').toLowerCase();
            console.log(`🔍 HF image caption: "${caption}"`);

            // Parse caption into structured attributes using keyword matching
            return this.parseCaptionToAttributes(caption, normalizedCategory);
        } catch (error) {
            console.error('HF image analysis error:', error);
            return this.getMockAttributes(normalizedCategory);
        }
    }

    /* ────────────────────────────────────
     * 2) ATTRIBUTES → 512-dim EMBEDDING
     * ──────────────────────────────────── */
    /* ────────────────────────────────────
     * 2) ATTRIBUTES → 512-dim EMBEDDING
     * ──────────────────────────────────── */
    async generateEmbeddingFromAttributes(
        attributes: ExtractedJewelleryAttributes,
    ): Promise<number[]> {
        // [DEMO MODE] Use deterministic embeddings to match seed-demo.ts data.
        // Real MPNet embeddings would not match the seeded random vectors.
        // To switch to real AI, we would need to re-seed the DB using MPNet.

        const seedString = this.createSeedString(attributes);
        console.log(`🧬 Generating demo embedding for: "${seedString}"`);

        return this.seededEmbedding(seedString);
    }

    /* ─── DEMO HELPERS (match seed-demo.ts) ─── */

    private createSeedString(attr: ExtractedJewelleryAttributes): string {
        // Format: demo-category-metal
        // Universal key to match ANY item of the same category & metal in the demo DB.
        // Ignores stones/style to ensure robust matching even if AI misses details.
        return `demo-${attr.selected_category}-${attr.metal_type}`;
    }

    private seededEmbedding(seed: string): number[] {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = (hash << 5) - hash + seed.charCodeAt(i);
            hash |= 0;
        }
        const vec: number[] = [];
        for (let i = 0; i < 512; i++) {
            hash = (hash * 1103515245 + 12345) & 0x7fffffff;
            vec.push((hash / 0x7fffffff) * 2 - 1); // range [-1, 1]
        }
        return vec;
    }

    /* ────────────────────────────────────
     *  CAPTION → ATTRIBUTES PARSER
     * ──────────────────────────────────── */

    private parseCaptionToAttributes(
        caption: string,
        selectedCategory: Category,
    ): ExtractedJewelleryAttributes {
        const metal = this.extractFromKeywords(caption, METAL_KEYWORDS) as ExtractedJewelleryAttributes['metal_type'] || 'gold';
        const gemstones = this.extractAllMatching(caption, GEMSTONE_KEYWORDS);
        const colors = this.extractAllMatching(caption, COLOR_KEYWORDS);
        const style = this.extractFromKeywords(caption, STYLE_KEYWORDS) as ExtractedJewelleryAttributes['design_style'] || 'modern';
        const crafts = this.extractAllFromKeywords(caption, CRAFT_KEYWORDS) as ExtractedJewelleryAttributes['craftsmanship_details'];
        const pattern = this.extractFromKeywords(caption, PATTERN_KEYWORDS) as ExtractedJewelleryAttributes['pattern_type'] || 'other';
        const setting = this.extractFromKeywords(caption, SETTING_KEYWORDS) as ExtractedJewelleryAttributes['stone_setting_style'] || (gemstones.length > 0 ? 'prong' : 'none');

        return {
            selected_category: selectedCategory,
            metal_type: metal,
            gemstone_types: gemstones.length > 0 ? gemstones : [],
            gemstone_colors: colors.length > 0 ? colors : undefined,
            design_style: style,
            craftsmanship_details: crafts.length > 0 ? crafts : ['plain'],
            pattern_type: pattern,
            stone_setting_style: setting,
        };
    }

    /** Find the first keyword that matches in text and return its mapped value */
    private extractFromKeywords<T>(text: string, keywords: Record<string, T>): T | null {
        for (const [keyword, value] of Object.entries(keywords)) {
            if (text.includes(keyword)) return value;
        }
        return null;
    }

    /** Find ALL keywords that match and return their mapped values (unique) */
    private extractAllFromKeywords<T>(text: string, keywords: Record<string, T>): T[] {
        const found = new Set<T>();
        for (const [keyword, value] of Object.entries(keywords)) {
            if (text.includes(keyword)) found.add(value);
        }
        return [...found];
    }

    /** Find all simple string keywords that appear in the text */
    private extractAllMatching(text: string, keywords: string[]): string[] {
        return keywords.filter(k => text.includes(k));
    }

    /* ────────────────────────────────────
     *  HELPERS
     * ──────────────────────────────────── */

    private attributesToText(attributes: ExtractedJewelleryAttributes): string {
        const gemstones = (attributes.gemstone_types || []).slice(0, 5).join(' ');
        const crafts = (attributes.craftsmanship_details || []).slice(0, 5).join(' ');
        const colors = (attributes.gemstone_colors || []).slice(0, 5).join(' ');
        return [
            attributes.selected_category,
            attributes.design_style,
            attributes.metal_type,
            attributes.pattern_type,
            attributes.stone_setting_style,
            crafts,
            gemstones,
            colors,
            'jewellery',
        ]
            .filter(Boolean)
            .join(' ');
    }

    private normalizeEmbedding(embedding: number[], targetDim: number): number[] {
        if (embedding.length === targetDim) return embedding;
        if (embedding.length > targetDim) return embedding.slice(0, targetDim);
        return [...embedding, ...new Array(targetDim - embedding.length).fill(0)];
    }

    private getMockAttributes(
        selectedCategory: Category,
    ): ExtractedJewelleryAttributes {
        // Return plausible attributes based on category
        const categoryDefaults: Record<Category, Partial<ExtractedJewelleryAttributes>> = {
            ring: { metal_type: 'gold', gemstone_types: ['diamond'], design_style: 'modern', stone_setting_style: 'prong' },
            necklace: { metal_type: 'gold', gemstone_types: [], design_style: 'modern', stone_setting_style: 'bezel' },
            earring: { metal_type: 'platinum', gemstone_types: ['diamond'], design_style: 'minimalist', stone_setting_style: 'prong' },
            bracelet: { metal_type: 'gold', gemstone_types: [], design_style: 'statement', stone_setting_style: 'none' },
            pendant: { metal_type: 'gold', gemstone_types: ['ruby'], design_style: 'modern', stone_setting_style: 'bezel' },
            bangle: { metal_type: 'gold', gemstone_types: [], design_style: 'ethnic', stone_setting_style: 'none' },
            other: { metal_type: 'gold', gemstone_types: [], design_style: 'modern', stone_setting_style: 'unknown' },
        };

        const defaults = categoryDefaults[selectedCategory] || categoryDefaults.other;

        return {
            selected_category: selectedCategory,
            metal_type: defaults.metal_type as any,
            gemstone_types: defaults.gemstone_types || [],
            gemstone_colors: defaults.gemstone_types?.length ? ['clear'] : undefined,
            design_style: defaults.design_style as any,
            craftsmanship_details: ['plain'],
            pattern_type: 'geometric',
            stone_setting_style: defaults.stone_setting_style as any,
        };
    }

    private getMockEmbedding(): number[] {
        // This is dead code now as generateEmbeddingFromAttributes uses seededEmbedding
        // but kept for typescript completeness if needed
        return Array.from({ length: 512 }, () => 0);
    }
}
