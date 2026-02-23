'use client';

import Link from 'next/link';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';

/* ── Unsplash images for visual richness ── */
const trendingImages = [
    { src: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=600&q=80', label: 'Gold Collection' },
    { src: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600&q=80', label: 'Statement Necklaces' },
    { src: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&q=80', label: 'Diamond Rings' },
    { src: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&q=80', label: 'Luxury Earrings' },
    { src: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=600&q=80', label: 'Bracelets' },
    { src: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600&q=80', label: 'Bridal Sets' },
];

const categoryCards = [
    { value: 'ring', label: 'Rings', img: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=300&q=80' },
    { value: 'necklace', label: 'Necklaces', img: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=300&q=80' },
    { value: 'earring', label: 'Earrings', img: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=300&q=80' },
    { value: 'bracelet', label: 'Bracelets', img: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=300&q=80' },
    { value: 'pendant', label: 'Pendants', img: 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=300&q=80' },
    { value: 'bangle', label: 'Bangles', img: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=300&q=80' },
];

const steps = [
    {
        title: 'Upload a reference image',
        desc: 'Share any photo or sketch of a jewellery design you want sourced.',
        img: 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=400&q=80',
    },
    {
        title: 'Review recommendations',
        desc: 'Browse AI-matched products from our catalogue with pricing and MOQ details.',
        img: 'https://images.unsplash.com/photo-1600721391776-b5cd0e0048f9?w=400&q=80',
    },
    {
        title: 'Submit a quote request',
        desc: 'Select your preferred items and request a formal quotation from our team.',
        img: 'https://images.unsplash.com/photo-1600721391776-b5cd0e0048f9?w=400&q=80',
    },
];

export default function BuyerDashboard() {
    const { state, progress } = useOnboardingProgress();
    const onboardingIncomplete = progress.completed < progress.total;

    return (
        <main className="py-0">
            {/* ─── Hero Welcome Banner ─── */}
            <section
                className="relative overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, #102a43 0%, #1a3a54 40%, #243b53 100%)',
                }}
            >
                {/* Decorative gold glow */}
                <div className="absolute top-0 right-0 w-96 h-96 -translate-y-1/4 translate-x-1/4 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #e8b931 0%, transparent 70%)' }}
                />
                <div className="absolute bottom-0 left-0 w-64 h-64 translate-y-1/3 -translate-x-1/4 rounded-full opacity-8"
                    style={{ background: 'radial-gradient(circle, #e8b931 0%, transparent 70%)' }}
                />

                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
                    <div className="grid lg:grid-cols-2 gap-8 items-center">
                        {/* Left — Text */}
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
                                style={{ background: 'rgba(232,185,49,0.12)', border: '1px solid rgba(232,185,49,0.2)' }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
                                <span className="text-xs font-medium text-gold-300">B2B Sourcing Platform</span>
                            </div>
                            <h1 className="font-display text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">
                                Source any jewellery design,{' '}
                                <span className="text-gold-400">instantly.</span>
                            </h1>
                            <p className="text-primary-200 leading-relaxed max-w-md mb-8">
                                Upload a reference image and our AI will match it with products from our curated catalogue. Get quotes in hours, not days.
                            </p>
                            <Link
                                href="/app/upload"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 hover:-translate-y-0.5"
                                style={{
                                    background: 'linear-gradient(135deg, #e8b931 0%, #d4a72c 100%)',
                                    color: '#102a43',
                                    boxShadow: '0 8px 24px rgba(232,185,49,0.3)',
                                }}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                </svg>
                                Upload a Design
                            </Link>
                        </div>

                        {/* Right — Image mosaic */}
                        <div className="hidden lg:grid grid-cols-2 gap-3 relative z-10">
                            <div className="space-y-3">
                                <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: '3/4' }}>
                                    <img src="https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=400&q=80"
                                        alt="Gold jewellery" className="w-full h-full object-cover" />
                                </div>
                                <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: '4/3' }}>
                                    <img src="https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&q=80"
                                        alt="Earrings" className="w-full h-full object-cover" />
                                </div>
                            </div>
                            <div className="space-y-3 pt-6">
                                <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: '4/3' }}>
                                    <img src="https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&q=80"
                                        alt="Necklace" className="w-full h-full object-cover" />
                                </div>
                                <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: '3/4' }}>
                                    <img src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&q=80"
                                        alt="Diamond rings" className="w-full h-full object-cover" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 py-10">

                {/* ─── Quick Actions ─── */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link href="/app/upload" className="card group hover:shadow-luxury-lg hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: 'linear-gradient(135deg, #102a43 0%, #243b53 100%)' }}
                            >
                                <svg className="w-6 h-6 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-primary-900">Upload Design</h3>
                                <p className="text-sm text-primary-500">Start a new AI-powered search</p>
                            </div>
                            <svg className="w-5 h-5 text-primary-300 group-hover:text-gold-500 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </div>
                    </Link>

                    <Link href="/app/requests" className="card group hover:shadow-luxury-lg hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: 'rgba(16,42,67,0.06)' }}
                            >
                                <svg className="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-primary-900">My Requests</h3>
                                <p className="text-sm text-primary-500">View quotes and drafts</p>
                            </div>
                            <svg className="w-5 h-5 text-primary-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </div>
                    </Link>

                    {onboardingIncomplete ? (
                        <Link href="/app/onboarding" className="card-gold group hover:shadow-gold-glow hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: 'rgba(232,185,49,0.12)' }}
                                >
                                    <svg className="w-6 h-6 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-primary-900">Complete Profile</h3>
                                    <p className="text-sm text-gold-700">Personalise your experience</p>
                                </div>
                                <svg className="w-5 h-5 text-gold-400 group-hover:text-gold-600 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            </div>
                        </Link>
                    ) : (
                        <div className="card flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: 'rgba(16,185,129,0.08)' }}
                            >
                                <svg className="w-6 h-6 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-semibold text-primary-900">Profile Complete</h3>
                                <p className="text-sm text-primary-500">You&apos;re all set to start sourcing</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── Browse by Category ─── */}
                <div>
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h2 className="font-display text-xl font-bold text-primary-900">Browse by Category</h2>
                            <p className="text-sm text-primary-500 mt-1">Select a category to start a focused search</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {categoryCards.map((cat) => (
                            <Link
                                key={cat.value}
                                href={`/app/upload?category=${cat.value}`}
                                className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-luxury-lg"
                                style={{ aspectRatio: '3/4' }}
                            >
                                <img src={cat.img} alt={cat.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(16,42,67,0.85) 0%, rgba(16,42,67,0.1) 60%)' }} />
                                <div className="absolute bottom-0 left-0 right-0 p-3">
                                    <span className="font-semibold text-white text-sm">{cat.label}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* ─── Trending Designs / Inspiration ─── */}
                <div>
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h2 className="font-display text-xl font-bold text-primary-900">Trending Designs</h2>
                            <p className="text-sm text-primary-500 mt-1">Get inspired by popular jewellery styles</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {trendingImages.map((img, i) => (
                            <div
                                key={i}
                                className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-luxury-lg hover:-translate-y-1"
                                style={{ aspectRatio: '4/3' }}
                            >
                                <img
                                    src={img.src}
                                    alt={img.label}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                    <span className="text-white font-medium text-sm">{img.label}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ─── How It Works ─── */}
                <div>
                    <h3 className="text-sm font-semibold text-primary-400 uppercase tracking-wider mb-5">How It Works</h3>
                    <div className="grid sm:grid-cols-3 gap-5">
                        {steps.map((step, i) => (
                            <div key={i} className="card overflow-hidden group hover:shadow-luxury-lg hover:-translate-y-0.5 transition-all duration-300">
                                <div className="h-36 -mx-6 -mt-6 mb-4 overflow-hidden">
                                    <img
                                        src={step.img}
                                        alt={step.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                </div>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={clsx(
                                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                        (i === 0 ? state.first_upload_completed : i === 1 ? state.recommendations_reviewed : state.first_quote_submitted)
                                            ? 'bg-accent-50 text-accent-600'
                                            : 'text-primary-400'
                                    )} style={(i === 0 ? state.first_upload_completed : i === 1 ? state.recommendations_reviewed : state.first_quote_submitted) ? {} : { background: 'rgba(16,42,67,0.06)' }}>
                                        {(i === 0 ? state.first_upload_completed : i === 1 ? state.recommendations_reviewed : state.first_quote_submitted) ? (
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            i + 1
                                        )}
                                    </div>
                                    <h4 className="font-medium text-primary-900 text-sm">{step.title}</h4>
                                </div>
                                <p className="text-xs text-primary-500 leading-relaxed">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ─── Trust Banner ─── */}
                <div className="rounded-2xl p-8 text-center"
                    style={{
                        background: 'linear-gradient(135deg, rgba(16,42,67,0.03) 0%, rgba(232,185,49,0.06) 100%)',
                        border: '1px solid rgba(232,185,49,0.12)',
                    }}
                >
                    <h3 className="font-display text-lg font-bold text-primary-900 mb-2">Trusted by 500+ Jewellery Businesses</h3>
                    <p className="text-sm text-primary-500 max-w-lg mx-auto mb-6">
                        From independent retailers to established brands, JewelSource streamlines jewellery sourcing with AI-powered matching and transparent pricing.
                    </p>
                    <div className="flex items-center justify-center gap-8 flex-wrap">
                        {[
                            { value: '10K+', label: 'Products Sourced' },
                            { value: '48h', label: 'Avg. Quote Time' },
                            { value: '95%', label: 'Match Accuracy' },
                            { value: '30+', label: 'Countries Served' },
                        ].map((stat) => (
                            <div key={stat.label}>
                                <div className="font-display text-2xl font-bold text-primary-900">{stat.value}</div>
                                <div className="text-xs text-primary-400">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}

function clsx(...classes: (string | boolean | undefined)[]) {
    return classes.filter(Boolean).join(' ');
}
