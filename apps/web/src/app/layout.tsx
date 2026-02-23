import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Visual Jewellery Sourcing | B2B Platform',
    description: 'Convert your jewellery inspiration into manufacturable products',
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
