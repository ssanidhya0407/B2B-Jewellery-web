/**
 * Format price range for display
 */
export function formatPriceRange(min: number, max: number, currency = 'USD'): string {
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });

    if (min === max) {
        return formatter.format(min);
    }

    return `${formatter.format(min)} - ${formatter.format(max)}`;
}

/**
 * Format lead time for display
 */
export function formatLeadTime(days: number): string {
    if (days <= 7) {
        return `${days} days`;
    } else if (days <= 30) {
        const weeks = Math.ceil(days / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''}`;
    } else {
        const months = Math.ceil(days / 30);
        return `${months} month${months > 1 ? 's' : ''}`;
    }
}

/**
 * Calculate display price with margin
 */
export function applyMargin(
    baseCost: number,
    marginPercentage: number,
    options?: { minMarkup?: number; maxMarkup?: number }
): number {
    let markup = baseCost * (marginPercentage / 100);

    if (options?.minMarkup && markup < options.minMarkup) {
        markup = options.minMarkup;
    }

    if (options?.maxMarkup && markup > options.maxMarkup) {
        markup = options.maxMarkup;
    }

    return Math.round(baseCost + markup);
}

/**
 * Generate a unique session code for display
 */
export function generateSessionCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SRC-${timestamp}-${random}`;
}

/**
 * Sanitize filename for upload
 */
export function sanitizeFilename(filename: string): string {
    return filename
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Check if file type is allowed
 */
export function isAllowedImageType(mimeType: string): boolean {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    return allowedTypes.includes(mimeType);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
