/**
 * JewelSource — Premium brand logo (diamond/gem icon + wordmark).
 *
 * Variants:
 *   • "light"  → icon on dark bg  (gold icon, white text)
 *   • "dark"   → icon on light bg (dark container with gold icon, dark text)
 *
 * Sizes:
 *   • "sm"  → 32 px container  (nav / mobile headers)
 *   • "md"  → 40 px container  (sidebar brand / login panels)
 */

interface LogoProps {
    variant?: 'light' | 'dark';
    size?: 'sm' | 'md';
    showText?: boolean;
    className?: string;
}

export default function Logo({
    variant = 'dark',
    size = 'sm',
    showText = true,
    className = '',
}: LogoProps) {
    const isLight = variant === 'light';
    const isMd = size === 'md';

    const containerSize = isMd ? 'w-10 h-10 rounded-xl' : 'w-8 h-8 rounded-lg';
    const iconSize = isMd ? 'w-5 h-5' : 'w-4 h-4';
    const textSize = isMd ? 'text-xl' : 'text-lg';

    const containerBg = isLight
        ? { background: 'rgba(232,185,49,0.15)', backdropFilter: 'blur(10px)' }
        : { background: 'linear-gradient(135deg, #102a43 0%, #243b53 100%)' };

    const textColor = isLight ? 'text-white' : 'text-primary-900';

    return (
        <div className={`flex items-center gap-2.5 ${className}`}>
            {/* Icon container */}
            <div
                className={`${containerSize} flex items-center justify-center`}
                style={containerBg}
            >
                <svg
                    className={`${iconSize} text-gold-400`}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* Diamond / gem faceted icon */}
                    <defs>
                        <linearGradient id="gemGold" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#f5d06b" />
                            <stop offset="50%" stopColor="#e8b931" />
                            <stop offset="100%" stopColor="#c9981a" />
                        </linearGradient>
                    </defs>
                    {/* Top facets */}
                    <path d="M12 2L4 8h16L12 2z" fill="url(#gemGold)" opacity="0.9" />
                    {/* Left facet */}
                    <path d="M4 8l8 14L6 10 4 8z" fill="url(#gemGold)" opacity="0.7" />
                    {/* Right facet */}
                    <path d="M20 8l-8 14 6-12 2-2z" fill="url(#gemGold)" opacity="0.7" />
                    {/* Centre facet */}
                    <path d="M6 10l6 12 6-12H6z" fill="url(#gemGold)" opacity="1" />
                    {/* Top highlight line */}
                    <path d="M8 8h8" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
                    {/* Centre lines */}
                    <path d="M6 10L12 2l6 8" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" fill="none" />
                    <path d="M6 10l6 12 6-12" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" fill="none" />
                </svg>
            </div>

            {/* Wordmark */}
            {showText && (
                <span className={`font-display ${textSize} font-semibold ${textColor} tracking-tight`}>
                    Jewel<span className="text-gold-500">Source</span>
                </span>
            )}
        </div>
    );
}
