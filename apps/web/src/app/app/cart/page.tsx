'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function CartIndexPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const redirect = async () => {
            try {
                const cart = (await api.getDraftCart()) as { id: string };
                router.replace(`/app/cart/${cart.id}`);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load cart');
            }
        };
        redirect();
    }, [router]);

    if (error) {
        return (
            <main className="py-20 text-center">
                <p className="text-primary-500">{error}</p>
            </main>
        );
    }

    return (
        <main className="py-20">
            <div className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5 text-gold-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-primary-500 text-sm">Loading your cart…</span>
            </div>
        </main>
    );
}
