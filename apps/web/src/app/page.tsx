import Link from 'next/link';
import PublicNav from '@/components/PublicNav';
import PublicFooter from '@/components/PublicFooter';

const steps = [
    {
        num: '01',
        title: 'Upload Your Design',
        description: 'Share any jewellery reference image — a sketch, photo, or inspiration piece.',
        img: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=600&q=80',
    },
    {
        num: '02',
        title: 'AI Finds Matches',
        description: 'Our AI analyses your design and searches our curated catalogue instantly.',
        img: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600&q=80',
    },
    {
        num: '03',
        title: 'Compare Options',
        description: 'Review prices, MOQ, delivery timelines, and material specifications at a glance.',
        img: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&q=80',
    },
    {
        num: '04',
        title: 'Request a Quote',
        description: 'Submit your selections and receive a formal quotation within 24 hours.',
        img: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&q=80',
    },
];

const stats = [
    { value: '7+', label: 'Jewellery Categories' },
    { value: '<10s', label: 'Match Results' },
    { value: '24h', label: 'Quote Turnaround' },
    { value: '100%', label: 'White-Labelled' },
];

const categories = [
    { name: 'Rings', img: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&q=80' },
    { name: 'Necklaces', img: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&q=80' },
    { name: 'Earrings', img: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&q=80' },
    { name: 'Bracelets', img: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&q=80' },
    { name: 'Pendants', img: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=400&q=80' },
    { name: 'Bangles', img: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=400&q=80' },
];

export default function HomePage() {
    return (
        <main className="min-h-screen">
            <PublicNav />

            {/* ====== HERO ====== */}
            <section className="relative overflow-hidden">
                {/* Background */}
                <div className="absolute inset-0" style={{
                    background: 'linear-gradient(135deg, #102a43 0%, #1a3a54 40%, #243b53 70%, #334e68 100%)',
                }} />
                {/* Soft gold orb */}
                <div className="absolute top-1/2 right-0 w-[600px] h-[600px] -translate-y-1/2 translate-x-1/4 rounded-full opacity-[0.07]"
                    style={{ background: 'radial-gradient(circle, #e8b931 0%, transparent 70%)' }}
                />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                        {/* Text */}
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-8"
                                style={{ background: 'rgba(232,185,49,0.12)', color: '#f5d06b', border: '1px solid rgba(232,185,49,0.2)' }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-glow" />
                                B2B Jewellery Sourcing Platform
                            </div>

                            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight">
                                Source any jewellery design{' '}
                                <span className="text-gradient-gold">in minutes</span>
                            </h1>

                            <p className="text-lg text-primary-200 mt-6 max-w-lg leading-relaxed">
                                Upload a reference image of any jewellery design. Our AI instantly matches it with ready-to-manufacture products — all under your brand.
                            </p>

                            <div className="mt-10 flex flex-col sm:flex-row gap-4">
                                <Link href="/register" className="btn-gold text-base py-3.5 px-8">
                                    Start Sourcing — Free
                                </Link>
                                <Link href="/how-it-works" className="btn-secondary text-base py-3.5 px-8" style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    borderColor: 'rgba(255,255,255,0.15)',
                                    color: '#d9e2ec',
                                }}>
                                    See How It Works
                                </Link>
                            </div>
                        </div>

                        {/* Hero Image Collage */}
                        <div className="hidden lg:block relative">
                            <div className="relative w-full aspect-[4/5] max-w-md ml-auto">
                                {/* Main image */}
                                <div className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <img
                                        src="https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=800&q=80"
                                        alt="Luxury gold jewellery collection"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(16,42,67,0.6) 100%)' }} />
                                </div>
                                {/* Floating card — top right */}
                                <div className="absolute -top-4 -right-4 p-3 rounded-2xl shadow-xl backdrop-blur-xl" style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(16,42,67,0.06)' }}>
                                    <img
                                        src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=200&q=80"
                                        alt="Diamond ring"
                                        className="w-20 h-20 rounded-xl object-cover"
                                    />
                                    <p className="text-[10px] font-semibold text-primary-900 mt-1.5 text-center">AI Match</p>
                                </div>
                                {/* Floating card — bottom left */}
                                <div className="absolute -bottom-4 -left-6 py-3 px-4 rounded-2xl shadow-xl backdrop-blur-xl flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(16,42,67,0.06)' }}>
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                                        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-primary-900">3 matches found</p>
                                        <p className="text-[10px] text-primary-400">Ready to quote</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ====== STATS ====== */}
            <section className="relative -mt-8 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="card grid grid-cols-2 md:grid-cols-4 gap-6 py-8 px-8" style={{
                        background: 'rgba(255,255,255,0.95)',
                        boxShadow: '0 10px 50px rgba(0,0,0,0.08)',
                    }}>
                        {stats.map((stat) => (
                            <div key={stat.label} className="text-center">
                                <div className="font-display text-2xl sm:text-3xl font-bold text-primary-900">{stat.value}</div>
                                <div className="text-xs sm:text-sm text-primary-500 mt-1">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ====== CATEGORIES SHOWCASE ====== */}
            <section className="py-24 section-cream">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-14">
                        <p className="text-xs font-semibold text-gold-600 uppercase tracking-widest mb-3">Categories</p>
                        <h2 className="font-display text-3xl lg:text-4xl font-bold text-primary-900">
                            Source across every jewellery category
                        </h2>
                        <p className="text-primary-500 mt-3 max-w-xl mx-auto">From classic diamond rings to contemporary statement pieces — upload any design and we'll match it.</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {categories.map((cat) => (
                            <div key={cat.name} className="group relative rounded-2xl overflow-hidden aspect-square cursor-pointer">
                                <img
                                    src={cat.img}
                                    alt={cat.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 transition-opacity duration-300" style={{ background: 'linear-gradient(180deg, transparent 30%, rgba(16,42,67,0.7) 100%)' }} />
                                <div className="absolute bottom-0 left-0 right-0 p-3">
                                    <p className="text-white font-display text-sm font-semibold text-center">{cat.name}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ====== HOW IT WORKS ====== */}
            <section className="py-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <p className="text-xs font-semibold text-gold-600 uppercase tracking-widest mb-3">How It Works</p>
                        <h2 className="font-display text-3xl lg:text-4xl font-bold text-primary-900">
                            From inspiration to quotation in four steps
                        </h2>
                    </div>

                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 stagger-children">
                        {steps.map((step) => (
                            <div key={step.num} className="group">
                                <div className="rounded-2xl overflow-hidden aspect-[4/3] mb-5 relative">
                                    <img
                                        src={step.img}
                                        alt={step.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(16,42,67,0.05) 0%, rgba(16,42,67,0.3) 100%)' }} />
                                    <span className="absolute top-3 left-3 text-xs font-bold text-white/80 tracking-widest bg-black/20 backdrop-blur-md px-2.5 py-1 rounded-lg">{step.num}</span>
                                </div>
                                <h3 className="font-display text-lg font-semibold text-primary-900 mb-2">{step.title}</h3>
                                <p className="text-sm text-primary-500 leading-relaxed">{step.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ====== WHY JEWELSOURCE ====== */}
            <section className="py-24 section-cream">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        {/* Image Side */}
                        <div className="relative">
                            <div className="rounded-3xl overflow-hidden shadow-luxury-lg aspect-[4/5]">
                                <img
                                    src="https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=800&q=80"
                                    alt="Jewellery crafting workspace"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {/* Overlay badge */}
                            <div className="absolute -bottom-6 -right-4 sm:right-6 p-4 rounded-2xl shadow-xl" style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(16,42,67,0.06)' }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #102a43, #334e68)' }}>
                                        <svg className="w-5 h-5 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-primary-900">100% White-labelled</p>
                                        <p className="text-xs text-primary-400">Your brand, always</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Text Side */}
                        <div>
                            <p className="text-xs font-semibold text-gold-600 uppercase tracking-widest mb-3">Why JewelSource</p>
                            <h2 className="font-display text-3xl lg:text-4xl font-bold text-primary-900 leading-tight">
                                Built for B2B jewellery buyers who value speed and precision
                            </h2>
                            <p className="text-primary-500 mt-5 leading-relaxed">
                                Stop wasting hours browsing catalogues. Upload a single reference image and let our AI do the sourcing. Every product is white-labelled as your offering.
                            </p>

                            <div className="mt-8 grid sm:grid-cols-2 gap-4">
                                {[
                                    {
                                        title: 'AI-Powered Matching',
                                        desc: 'Advanced visual AI analyses your design and finds the closest products.',
                                    },
                                    {
                                        title: 'White-Labelled Sourcing',
                                        desc: 'Every product is presented under your brand. Supplier identities stay hidden.',
                                    },
                                    {
                                        title: 'Transparent Pricing',
                                        desc: 'Clear price ranges and MOQ details upfront. No hidden costs.',
                                    },
                                    {
                                        title: 'Fast Turnaround',
                                        desc: 'Product matches in seconds, formal quotation within 24 hours.',
                                    },
                                ].map((item) => (
                                    <div key={item.title} className="card-gold p-5">
                                        <h4 className="font-semibold text-primary-900 mb-1.5">{item.title}</h4>
                                        <p className="text-sm text-primary-500 leading-relaxed">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ====== TESTIMONIAL / TRUST ====== */}
            <section className="py-24">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative rounded-3xl overflow-hidden">
                        <img
                            src="https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?w=1200&q=80"
                            alt="Luxury jewellery display"
                            className="w-full h-72 sm:h-96 object-cover"
                        />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(16,42,67,0.85) 0%, rgba(16,42,67,0.6) 100%)' }} />
                        <div className="absolute inset-0 flex items-center justify-center p-8">
                            <div className="text-center max-w-2xl">
                                <svg className="w-10 h-10 text-gold-400 mx-auto mb-6 opacity-60" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                                </svg>
                                <p className="font-display text-xl sm:text-2xl font-semibold text-white leading-relaxed">
                                    &ldquo;JewelSource cut our sourcing time from weeks to hours. We just upload a design and get matched products immediately.&rdquo;
                                </p>
                                <div className="mt-6">
                                    <p className="text-sm font-semibold text-gold-300">Procurement Director</p>
                                    <p className="text-xs text-primary-300 mt-0.5">Leading Jewellery Retailer, Dubai</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ====== CTA ====== */}
            <section className="py-24 section-cream">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="card-dark p-12 sm:p-16 rounded-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 -translate-y-1/3 translate-x-1/3 rounded-full opacity-15"
                            style={{ background: 'radial-gradient(circle, #e8b931 0%, transparent 70%)' }}
                        />
                        <div className="absolute bottom-0 left-0 w-48 h-48 translate-y-1/3 -translate-x-1/3 rounded-full opacity-10"
                            style={{ background: 'radial-gradient(circle, #e8b931 0%, transparent 70%)' }}
                        />
                        <div className="relative">
                            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
                                Ready to transform your sourcing?
                            </h2>
                            <p className="text-primary-200 mt-4 max-w-xl mx-auto leading-relaxed">
                                Join retailers and wholesalers who source jewellery designs in minutes, not weeks.
                            </p>
                            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                                <Link href="/register" className="btn-gold text-base py-3.5 px-8">
                                    Create Free Account
                                </Link>
                                <Link href="/how-it-works" className="inline-flex items-center justify-center font-medium py-3.5 px-8 rounded-xl transition-all duration-300"
                                    style={{ border: '1px solid rgba(255,255,255,0.2)', color: '#d9e2ec' }}
                                >
                                    Learn More
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <PublicFooter />
        </main>
    );
}
