import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Jewellery Sourcing Dashboard',
    description: 'Internal operations dashboard for jewellery sourcing platform',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="antialiased">{children}</body>
        </html>
    );
}
