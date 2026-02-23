'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAuthPayload } from '@/lib/auth';
import {
    getDefaultOnboardingState,
    getOnboardingProgress,
    onboardingEventName,
    OnboardingState,
    readOnboardingState,
} from '@/lib/onboarding';

export function useOnboardingProgress() {
    const [userId, setUserId] = useState<string | null>(null);
    const [state, setState] = useState<OnboardingState>(getDefaultOnboardingState());

    useEffect(() => {
        const payload = getAuthPayload();
        if (!payload?.sub) return;

        setUserId(payload.sub);
        setState(readOnboardingState(payload.sub));

        const handleStorage = () => setState(readOnboardingState(payload.sub));
        const handleCustom = () => setState(readOnboardingState(payload.sub));

        window.addEventListener('storage', handleStorage);
        window.addEventListener(onboardingEventName(), handleCustom);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener(onboardingEventName(), handleCustom);
        };
    }, []);

    const progress = useMemo(() => getOnboardingProgress(state), [state]);

    return { userId, state, progress };
}
