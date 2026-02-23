import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ExtractedJewelleryAttributes {
    /**
     * This value MUST equal the buyer-selected category (source of truth).
     */
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

function normalizeSelectedCategory(category: string): ExtractedJewelleryAttributes['selected_category'] {
    if (category === 'earrings') return 'earring';
    if (category === 'rings') return 'ring';
    if (category === 'necklaces') return 'necklace';
    if (category === 'bracelets') return 'bracelet';
    if (category === 'pendants') return 'pendant';
    if (category === 'bangles') return 'bangle';
    if (
        category === 'ring' ||
        category === 'necklace' ||
        category === 'earring' ||
        category === 'bracelet' ||
        category === 'pendant' ||
        category === 'bangle' ||
        category === 'other'
    ) {
        return category;
    }
    return 'other';
}

@Injectable()
export class GeminiVisionService {
    private genAI: GoogleGenerativeAI;
    private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('gemini.apiKey');
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        }
    }

    async analyzeImage(
        imageBuffer: Buffer,
        selectedCategory: string,
        userContext?: string,
    ): Promise<ExtractedJewelleryAttributes> {
        const normalizedCategory = normalizeSelectedCategory(selectedCategory);

        if (!this.model) {
            console.warn('Gemini API not configured, returning mock attributes');
            return this.getMockAttributes(normalizedCategory);
        }

        const base64Image = imageBuffer.toString('base64');

        const prompt = `You are a jewellery expert.

The buyer selected the jewellery category: "${normalizedCategory}".
This category is SOURCE OF TRUTH. Do NOT infer a different category. Always set selected_category to "${normalizedCategory}".

Analyze this image and extract these attributes in valid JSON format:

Required attributes:
- selected_category: MUST be exactly "${normalizedCategory}"
- metal_type: ["gold", "silver", "platinum", "rose_gold", "mixed", "unknown"]
- gemstone_types: array of gemstone names (e.g., ["diamond","sapphire"] or [] if none/unsure)
- gemstone_colors: optional array of colors (e.g., ["clear","blue"]) aligned to the visible stones
- design_style: ["vintage", "modern", "ethnic", "minimalist", "statement", "other"]
- craftsmanship_details: array of ["filigree","engraved","plain","textured","other"] (can include multiple)
- pattern_type: ["floral", "geometric", "abstract", "other"]
- stone_setting_style: ["prong","bezel","pave","channel","none","other","unknown"]

Rules:
- If you are unsure, use "unknown" or "other", and use empty arrays when appropriate.
- Do not include supplier/brand names.
- Output MUST be valid JSON (no markdown, no commentary).

${userContext ? `Additional context from user: ${userContext}` : ''}

Return ONLY valid JSON, no other text.`;

        try {
            const result = await this.model.generateContent([
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: base64Image,
                    },
                },
                prompt,
            ]);

            const response = await result.response;
            const text = response.text();

            // Parse JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]) as ExtractedJewelleryAttributes;
                // Enforce buyer-selected category as source-of-truth.
                parsed.selected_category = normalizedCategory;
                // Ensure arrays exist for downstream logic.
                parsed.gemstone_types = Array.isArray(parsed.gemstone_types) ? parsed.gemstone_types : [];
                parsed.craftsmanship_details = Array.isArray(parsed.craftsmanship_details)
                    ? parsed.craftsmanship_details
                    : ['other'];
                return parsed;
            }

            throw new Error('No valid JSON in response');
        } catch (error) {
            console.error('Gemini analysis error:', error);
            return this.getMockAttributes(normalizedCategory);
        }
    }

    async generateEmbeddingFromAttributes(
        attributes: ExtractedJewelleryAttributes,
    ): Promise<number[]> {
        if (!this.genAI) {
            console.warn('Gemini API not configured, returning mock embedding');
            return this.getMockEmbedding();
        }

        try {
            // Use the embedding model
            const embeddingModel = this.genAI.getGenerativeModel({
                model: 'text-embedding-004',
            });

            const textDescription = this.attributesToText(attributes);

            const result = await embeddingModel.embedContent(textDescription);
            const embedding = result.embedding.values;

            // Pad or truncate to 512 dimensions
            return this.normalizeEmbedding(embedding, 512);
        } catch (error) {
            console.error('Embedding generation error:', error);
            return this.getMockEmbedding();
        }
    }

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
        if (embedding.length === targetDim) {
            return embedding;
        }

        if (embedding.length > targetDim) {
            return embedding.slice(0, targetDim);
        }

        // Pad with zeros
        return [...embedding, ...new Array(targetDim - embedding.length).fill(0)];
    }

    private getMockAttributes(
        selectedCategory: ExtractedJewelleryAttributes['selected_category'],
    ): ExtractedJewelleryAttributes {
        return {
            selected_category: selectedCategory,
            metal_type: 'gold',
            gemstone_types: ['diamond'],
            gemstone_colors: ['clear'],
            design_style: 'modern',
            craftsmanship_details: ['plain'],
            pattern_type: 'geometric',
            stone_setting_style: 'prong',
        };
    }

    private getMockEmbedding(): number[] {
        // Return a random 512-dim vector for testing
        return Array.from({ length: 512 }, () => Math.random() * 2 - 1);
    }
}
