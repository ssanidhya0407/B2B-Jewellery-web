import PublicNav from '@/components/PublicNav';
import PublicFooter from '@/components/PublicFooter';
import Link from 'next/link';

const steps = [
    {
        num: '01',
        title: 'Upload Your Design',
        description: 'Share any reference image — a photo, sketch, or screenshot of the jewellery design you want sourced. Select the product category (ring, necklace, earring, bracelet, etc.).',
        detail: 'We accept JPG, PNG, and WebP images up to 10MB. The clearer and more detailed the image, the better the match quality.',
        icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
        ),
    },
    {
        num: '02',
        title: 'AI Analyses Your Design',
        description: 'Our AI system extracts key attributes from your image: metal type, gemstone details, design style, craftsmanship patterns, and stone settings.',
        detail: 'The analysis considers the category you selected and identifies visual features that matter most for finding accurate product matches.',
        icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
        ),
    },
    {
        num: '03',
        title: 'Review Matched Products',
        description: 'We present your best match alongside multiple design alternatives. Each product shows price range, minimum order quantity, material details, and estimated delivery time.',
        detail: 'Our system prioritises products we can deliver quickly from existing stock, and supplements with made-to-order alternatives for maximum selection.',
        icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
        ),
    },
    {
        num: '04',
        title: 'Request a Quote',
        description: 'Select the products you\'re interested in, add them to your request, and submit for a formal quotation. Our sourcing team reviews and responds within 24 hours.',
        detail: 'The quotation includes final pricing, exact MOQ, delivery schedule, and payment terms. Negotiation is welcomed — we work to meet your budget.',
        icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
        ),
    },
];

const faqs = [
    { q: 'How accurate are the AI matches?', a: 'Our AI achieves high accuracy for visual similarity matching. The category you select helps narrow the search. Results include a match percentage so you can judge quality at a glance.' },
    { q: 'How is pricing determined?', a: 'Products from our existing inventory have fixed pricing. For made-to-order items, we provide an approximate price range. Final pricing is confirmed in the formal quotation.' },
    { q: 'What are the minimum order quantities?', a: 'MOQ varies by product and source. Each recommendation clearly displays the minimum order quantity. We work with you to find options that match your volume needs.' },
    { q: 'How long does the quotation process take?', a: 'Once you submit a request, our sourcing team typically responds within 24 hours with a formal quotation including final pricing and delivery terms.' },
];

export default function HowItWorksPage() {
    return (
        <main className="min-h-screen">
            <PublicNav />

            {/* Hero */}
            <section className="py-20 lg:py-24 section-cream">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-xs font-semibold text-gold-600 uppercase tracking-widest mb-4">How It Works</p>
                    <h1 className="font-display text-4xl lg:text-5xl font-bold text-primary-900 leading-tight">
                        From design inspiration to formal quotation
                    </h1>
                    <p className="text-primary-500 mt-5 max-w-2xl mx-auto leading-relaxed">
                        A simple four-step process that turns any jewellery reference image into sourced, quotable products.
                    </p>
                </div>
            </section>

            {/* Steps */}
            <section className="py-20">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="space-y-6 stagger-children">
                        {steps.map((step, i) => (
                            <div key={step.num} className="card grid md:grid-cols-[64px_1fr] gap-6 items-start">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-gold-600 shrink-0"
                                    style={{ background: 'rgba(232,185,49,0.08)' }}
                                >
                                    {step.icon}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xs font-bold text-primary-300 tracking-widest">STEP {step.num}</span>
                                    </div>
                                    <h3 className="font-display text-xl font-semibold text-primary-900 mb-2">{step.title}</h3>
                                    <p className="text-primary-600 leading-relaxed">{step.description}</p>
                                    <p className="text-sm text-primary-400 mt-3 leading-relaxed">{step.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-20 section-cream">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="font-display text-3xl font-bold text-primary-900 text-center mb-12">Frequently Asked Questions</h2>
                    <div className="space-y-4 stagger-children">
                        {faqs.map((faq) => (
                            <div key={faq.q} className="card">
                                <h3 className="font-semibold text-primary-900 mb-2">{faq.q}</h3>
                                <p className="text-sm text-primary-500 leading-relaxed">{faq.a}</p>
                            </div>
                        ))}
                    </div>

                    <div className="text-center mt-12">
                        <Link href="/register" className="btn-gold text-base py-3.5 px-8">
                            Start Sourcing Today
                        </Link>
                    </div>
                </div>
            </section>

            <PublicFooter />
        </main>
    );
}
