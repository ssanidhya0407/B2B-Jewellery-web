'use client';

import { useEffect } from 'react';

const FALLBACK_SRC = '/product-images/other-01.jpg';

export function GlobalImageFallback() {
    useEffect(() => {
        const onImageError = (event: Event) => {
            const target = event.target as HTMLImageElement | null;
            if (!target || target.tagName !== 'IMG') return;
            if (target.dataset.fallbackApplied === '1') return;
            target.dataset.fallbackApplied = '1';
            target.src = FALLBACK_SRC;
        };

        document.addEventListener('error', onImageError, true);
        return () => document.removeEventListener('error', onImageError, true);
    }, []);

    return null;
}
