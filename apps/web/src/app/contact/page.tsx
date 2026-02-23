import PublicNav from '@/components/PublicNav';
import PublicFooter from '@/components/PublicFooter';

export default function ContactPage() {
    return (
        <main className="min-h-screen">
            <PublicNav />
            <section className="py-16 lg:py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h1 className="font-display text-4xl font-bold text-gray-900">Contact</h1>
                    <p className="text-gray-600 mt-4">
                        For buyer onboarding, internal team setup, or integration support with your existing brand systems.
                    </p>

                    <div className="mt-8 grid gap-6 md:grid-cols-2">
                        <div className="card">
                            <h2 className="font-semibold text-gray-900">Buyer Support</h2>
                            <p className="text-sm text-gray-600 mt-2">
                                Account setup, upload workflow, and quote request guidance.
                            </p>
                            <p className="mt-4 text-sm text-gray-700">buyers@b2bjewellerysourcing.com</p>
                        </div>
                        <div className="card">
                            <h2 className="font-semibold text-gray-900">Operations & Integrations</h2>
                            <p className="text-sm text-gray-600 mt-2">
                                Internal team access, API integration, and data sync configuration.
                            </p>
                            <p className="mt-4 text-sm text-gray-700">ops@b2bjewellerysourcing.com</p>
                        </div>
                    </div>
                </div>
            </section>
            <PublicFooter />
        </main>
    );
}
