'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { getAuthPayload } from '@/lib/auth';
import {
    isBuyerProfileComplete,
    onboardingEventName,
    readBuyerProfile,
    readOnboardingState,
} from '@/lib/onboarding';

export default function BuyerAccessGate({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const handler = () => setVersion((prev) => prev + 1);
        window.addEventListener(onboardingEventName(), handler);
        return () => window.removeEventListener(onboardingEventName(), handler);
    }, []);

    useEffect(() => {
        const payload = getAuthPayload();
        if (!payload?.sub) {
            router.replace('/login?workspace=buyer');
            return;
        }

        const onboarding = readOnboardingState(payload.sub);
        const profile = readBuyerProfile(payload.sub);
        const profileCompleted = onboarding.profile_completed && isBuyerProfileComplete(profile);

        const allowWithoutProfile = pathname === '/app' || pathname.startsWith('/app/onboarding');

        if (!profileCompleted && !allowWithoutProfile) {
            router.replace(`/app/onboarding?next=${encodeURIComponent(pathname)}`);
            return;
        }

        if (profileCompleted && pathname.startsWith('/app/onboarding')) {
            const params = new URLSearchParams(window.location.search);
            const nextPath = params.get('next');
            if (nextPath && nextPath.startsWith('/app') && nextPath !== '/app/onboarding') {
                router.replace(nextPath);
                return;
            }
            router.replace('/app');
            return;
        }

        setReady(true);
    }, [pathname, router, version]);

    if (!ready) {
        return (
            <div className="min-h-[40vh] flex items-center justify-center">
                <div className="text-sm text-gray-500">Loading workspace...</div>
            </div>
        );
    }

    return <>{children}</>;
}
