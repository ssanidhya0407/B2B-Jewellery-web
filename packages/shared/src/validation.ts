import {
    JEWELLERY_CATEGORIES,
    JEWELLERY_CATEGORY_ALIASES,
    VISUAL_METAL_TYPES,
    DESIGN_STYLE_TYPES,
    CRAFTSMANSHIP_DETAILS,
    PATTERN_TYPES,
    STONE_SETTING_STYLES,
} from './constants';

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long' };
    }

    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }

    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number' };
    }

    return { valid: true };
}

/**
 * Validate jewellery attributes from Gemini response
 */
export function validateJewelleryAttributes(attributes: unknown): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!attributes || typeof attributes !== 'object') {
        return { valid: false, errors: ['Attributes must be an object'] };
    }

    const attrs = attributes as Record<string, unknown>;

    // Validate selected_category (buyer-selected source-of-truth)
    const normalizedCategory =
        typeof attrs.selected_category === 'string'
            ? (JEWELLERY_CATEGORY_ALIASES[attrs.selected_category] ?? attrs.selected_category)
            : attrs.selected_category;
    if (
        !normalizedCategory ||
        !JEWELLERY_CATEGORIES.includes(normalizedCategory as typeof JEWELLERY_CATEGORIES[number])
    ) {
        errors.push(`Invalid selected_category. Must be one of: ${JEWELLERY_CATEGORIES.join(', ')}`);
    }

    // Validate metal_type
    if (!attrs.metal_type || !VISUAL_METAL_TYPES.includes(attrs.metal_type as typeof VISUAL_METAL_TYPES[number])) {
        errors.push(`Invalid metal_type. Must be one of: ${VISUAL_METAL_TYPES.join(', ')}`);
    }

    // Validate gemstone_types (array of strings)
    if (attrs.gemstone_types !== undefined) {
        if (!Array.isArray(attrs.gemstone_types)) {
            errors.push('gemstone_types must be an array');
        } else if (!(attrs.gemstone_types as unknown[]).every((v) => typeof v === 'string')) {
            errors.push('gemstone_types must be an array of strings');
        }
    }

    // Validate gemstone_colors (optional array of strings)
    if (attrs.gemstone_colors !== undefined) {
        if (!Array.isArray(attrs.gemstone_colors)) {
            errors.push('gemstone_colors must be an array');
        } else if (!(attrs.gemstone_colors as unknown[]).every((v) => typeof v === 'string')) {
            errors.push('gemstone_colors must be an array of strings');
        }
    }

    // Validate design_style
    if (!attrs.design_style || !DESIGN_STYLE_TYPES.includes(attrs.design_style as typeof DESIGN_STYLE_TYPES[number])) {
        errors.push(`Invalid design_style. Must be one of: ${DESIGN_STYLE_TYPES.join(', ')}`);
    }

    // Validate craftsmanship_details
    if (!attrs.craftsmanship_details || !Array.isArray(attrs.craftsmanship_details)) {
        errors.push('craftsmanship_details must be an array');
    } else {
        for (const detail of attrs.craftsmanship_details) {
            if (!CRAFTSMANSHIP_DETAILS.includes(detail as typeof CRAFTSMANSHIP_DETAILS[number])) {
                errors.push(`Invalid craftsmanship detail: ${detail}. Must be one of: ${CRAFTSMANSHIP_DETAILS.join(', ')}`);
            }
        }
    }

    // Validate pattern_type
    if (!attrs.pattern_type || !PATTERN_TYPES.includes(attrs.pattern_type as typeof PATTERN_TYPES[number])) {
        errors.push(`Invalid pattern_type. Must be one of: ${PATTERN_TYPES.join(', ')}`);
    }

    // Validate stone_setting_style
    if (
        !attrs.stone_setting_style ||
        !STONE_SETTING_STYLES.includes(attrs.stone_setting_style as typeof STONE_SETTING_STYLES[number])
    ) {
        errors.push(`Invalid stone_setting_style. Must be one of: ${STONE_SETTING_STYLES.join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate quantity for cart items
 */
export function validateQuantity(quantity: number, moq: number = 1): { valid: boolean; message?: string } {
    if (!Number.isInteger(quantity) || quantity < 1) {
        return { valid: false, message: 'Quantity must be a positive integer' };
    }

    if (quantity < moq) {
        return { valid: false, message: `Quantity must be at least ${moq} (MOQ)` };
    }

    return { valid: true };
}
