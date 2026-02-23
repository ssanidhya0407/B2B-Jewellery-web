export type OnboardingStep =
    | 'account_created'
    | 'profile_completed'
    | 'first_upload_completed'
    | 'recommendations_reviewed'
    | 'first_quote_submitted';

export interface OnboardingState {
    account_created: boolean;
    profile_completed: boolean;
    first_upload_completed: boolean;
    recommendations_reviewed: boolean;
    first_quote_submitted: boolean;
}

export interface BuyerProfile {
    businessType: string;
    typicalOrderVolume: string;
    preferredCategories: string[];
    notes?: string;
}

export const ONBOARDING_STEPS: Array<{ key: OnboardingStep; label: string }> = [
    { key: 'account_created', label: 'Account setup' },
    { key: 'profile_completed', label: 'Business profile completion' },
    { key: 'first_upload_completed', label: 'First design upload' },
    { key: 'recommendations_reviewed', label: 'Review recommendations' },
    { key: 'first_quote_submitted', label: 'Submit first quote request' },
];

const DEFAULT_STATE: OnboardingState = {
    account_created: false,
    profile_completed: false,
    first_upload_completed: false,
    recommendations_reviewed: false,
    first_quote_submitted: false,
};

const DEFAULT_PROFILE: BuyerProfile = {
    businessType: '',
    typicalOrderVolume: '',
    preferredCategories: [],
    notes: '',
};

const EVENT_NAME = 'buyer-onboarding-updated';

function storageKey(userId: string) {
    return `buyer_onboarding_v1:${userId}`;
}

function profileStorageKey(userId: string) {
    return `buyer_profile_v1:${userId}`;
}

export function getDefaultOnboardingState(): OnboardingState {
    return { ...DEFAULT_STATE };
}

export function readOnboardingState(userId: string): OnboardingState {
    if (typeof window === 'undefined') return getDefaultOnboardingState();

    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return getDefaultOnboardingState();

    try {
        const parsed = JSON.parse(raw) as Partial<OnboardingState>;
        return {
            account_created: Boolean(parsed.account_created),
            profile_completed: Boolean(parsed.profile_completed),
            first_upload_completed: Boolean(parsed.first_upload_completed),
            recommendations_reviewed: Boolean(parsed.recommendations_reviewed),
            first_quote_submitted: Boolean(parsed.first_quote_submitted),
        };
    } catch {
        return getDefaultOnboardingState();
    }
}

function writeOnboardingState(userId: string, state: OnboardingState) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function updateOnboardingStep(userId: string, step: OnboardingStep) {
    const current = readOnboardingState(userId);
    const next = {
        ...current,
        [step]: true,
    };
    writeOnboardingState(userId, next);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
}

export function getOnboardingProgress(state: OnboardingState) {
    const total = ONBOARDING_STEPS.length;
    const completed = ONBOARDING_STEPS.filter((step) => state[step.key]).length;
    const percent = Math.round((completed / total) * 100);
    return { total, completed, percent };
}

export function onboardingEventName() {
    return EVENT_NAME;
}

export function readBuyerProfile(userId: string): BuyerProfile {
    if (typeof window === 'undefined') return { ...DEFAULT_PROFILE };

    const raw = window.localStorage.getItem(profileStorageKey(userId));
    if (!raw) return { ...DEFAULT_PROFILE };

    try {
        const parsed = JSON.parse(raw) as Partial<BuyerProfile>;
        return {
            businessType: parsed.businessType || '',
            typicalOrderVolume: parsed.typicalOrderVolume || '',
            preferredCategories: Array.isArray(parsed.preferredCategories)
                ? parsed.preferredCategories.filter((value) => typeof value === 'string')
                : [],
            notes: typeof parsed.notes === 'string' ? parsed.notes : '',
        };
    } catch {
        return { ...DEFAULT_PROFILE };
    }
}

export function writeBuyerProfile(userId: string, profile: BuyerProfile) {
    if (typeof window === 'undefined') return;

    const normalized: BuyerProfile = {
        businessType: profile.businessType.trim(),
        typicalOrderVolume: profile.typicalOrderVolume.trim(),
        preferredCategories: profile.preferredCategories.filter(Boolean),
        notes: profile.notes?.trim() || '',
    };

    window.localStorage.setItem(profileStorageKey(userId), JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function isBuyerProfileComplete(profile: BuyerProfile): boolean {
    return Boolean(
        profile.businessType &&
        profile.typicalOrderVolume &&
        profile.preferredCategories.length > 0
    );
}
