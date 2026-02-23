import Link from 'next/link';
import Logo from '@/components/Logo';

const platformLinks = [
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/for-buyers', label: 'For Buyers' },
    { href: '/register', label: 'Get Started' },
];

const companyLinks = [
    { href: '/contact', label: 'Contact Us' },
    { href: '/contact', label: 'Privacy Policy' },
    { href: '/contact', label: 'Terms of Service' },
];

export default function PublicFooter() {
    return (
        <footer className="border-t border-primary-100/50" style={{ background: '#f5f3ef' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid md:grid-cols-4 gap-10">
                    {/* Brand Column */}
                    <div className="md:col-span-2">
                        <Logo variant="dark" size="sm" className="mb-4" />
                        <p className="text-sm text-primary-500 max-w-sm leading-relaxed">
                            The smarter way to source jewellery. Upload any design, get instant matches from our curated catalogue, and request quotes — all in one place.
                        </p>
                    </div>

                    {/* Platform */}
                    <div>
                        <h4 className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-4">Platform</h4>
                        <ul className="space-y-3">
                            {platformLinks.map((link) => (
                                <li key={link.label}>
                                    <Link href={link.href} className="text-sm text-primary-600 hover:text-primary-900 transition-colors">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Company */}
                    <div>
                        <h4 className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-4">Company</h4>
                        <ul className="space-y-3">
                            {companyLinks.map((link, i) => (
                                <li key={i}>
                                    <Link href={link.href} className="text-sm text-primary-600 hover:text-primary-900 transition-colors">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="mt-12 pt-8 border-t border-primary-100/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-primary-400">
                        © {new Date().getFullYear()} JewelSource. All rights reserved.
                    </p>
                    <Link href="/login?workspace=operations" className="text-xs text-primary-300 hover:text-primary-500 transition-colors">
                        Team Login
                    </Link>
                </div>
            </div>
        </footer>
    );
}
