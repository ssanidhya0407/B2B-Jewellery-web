import Link from 'next/link';
import PublicNav from '@/components/PublicNav';
import PublicFooter from '@/components/PublicFooter';

const benefits = [
    {
        title: 'Upload Any Design',
        description: 'Share a photo, sketch, or screenshot. Our AI handles the rest — extracting attributes and finding matches across our entire catalogue.',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
        ),
    },
    {
        title: 'Instant Product Matches',
        description: 'Get results in under 10 seconds. See your best match and multiple alternatives with pricing, MOQ, and delivery details — all upfront.',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
        ),
    },
    {
        title: 'Transparent Pricing',
        description: 'No hidden costs. Products from our stock show exact pricing; made-to-order items show price ranges. Final pricing is confirmed in the quotation.',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
    {
        title: 'White-Labelled',
        description: 'Every product is presented under your brand. Your customers never see our supplier network — only the designs you curate.',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
        ),
    },
    {
        title: 'MOQ Visibility',
        description: 'See minimum order quantities for every product before you commit. Filter by volume to find products that fit your order size.',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
        ),
    },
    {
        title: 'Formal Quotations',
        description: 'Submit a request and receive a professional quotation within 24 hours with final pricing, delivery schedule, and payment terms.',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
        ),
    },
];

export default function BuyersPage() {
    return (
        <main className="min-h-screen">
            <PublicNav />

            {/* Hero */}
            <section className="py-20 lg:py-24 section-cream">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-xs font-semibold text-gold-600 uppercase tracking-widest mb-4">For Buyers</p>
                    <h1 className="font-display text-4xl lg:text-5xl font-bold text-primary-900 leading-tight">
                        Source jewellery designs faster than ever
                    </h1>
                    <p className="text-primary-500 mt-5 max-w-2xl mx-auto leading-relaxed">
                        Built for jewellery retailers, wholesalers, and brands who need fast, reliable design sourcing with transparent pricing and clear MOQ details.
                    </p>
                    <div className="mt-8">
                        <Link href="/register" className="btn-gold text-base py-3.5 px-8">
                            Create Free Account
                        </Link>
                    </div>
                </div>
            </section>

            {/* Benefits Grid */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-14">
                        <h2 className="font-display text-3xl font-bold text-primary-900">Everything you need to source with confidence</h2>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
                        {benefits.map((item) => (
                            <div key={item.title} className="card group hover:shadow-luxury-lg hover:-translate-y-1 transition-all duration-300">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 text-gold-600"
                                    style={{ background: 'rgba(232,185,49,0.08)' }}
                                >
                                    {item.icon}
                                </div>
                                <h3 className="font-semibold text-primary-900 mb-2">{item.title}</h3>
                                <p className="text-sm text-primary-500 leading-relaxed">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Buyer Journey */}
            <section className="py-20 section-cream">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="font-display text-3xl font-bold text-primary-900">Your sourcing journey</h2>
                        <p className="text-primary-500 mt-3">From sign-up to confirmed order, here&apos;s what to expect.</p>
                    </div>

                    <div className="space-y-4 stagger-children">
                        {[
                            'Create your account and complete a short business profile',
                            'Upload a design image and select the product category',
                            'Review your best match and explore alternative designs',
                            'Compare products by price, MOQ, and delivery timeline',
                            'Add your preferred items and submit a quote request',
                            'Receive a formal quotation and negotiate terms',
                        ].map((step, i) => (
                            <div key={i} className="card flex items-center gap-4 py-4">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                                    style={{ background: 'rgba(232,185,49,0.1)', color: '#b07d18' }}
                                >
                                    {i + 1}
                                </div>
                                <p className="text-primary-700">{step}</p>
                            </div>
                        ))}
                    </div>

                    <div className="text-center mt-12">
                        <Link href="/register" className="btn-primary text-base py-3.5 px-8">
                            Get Started Now
                        </Link>
                    </div>
                </div>
            </section>

            <PublicFooter />
        </main>
    );
}
