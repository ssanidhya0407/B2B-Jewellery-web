/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f0f4f8',
                    100: '#d9e2ec',
                    200: '#bcccdc',
                    300: '#9fb3c8',
                    400: '#829ab1',
                    500: '#627d98',
                    600: '#486581',
                    700: '#334e68',
                    800: '#243b53',
                    900: '#102a43',
                    950: '#0a1929',
                },
                gold: {
                    50: '#fefdf5',
                    100: '#fdf8e1',
                    200: '#fcefc3',
                    300: '#f9e29a',
                    400: '#f5d06b',
                    500: '#e8b931',
                    600: '#d4a01d',
                    700: '#b07d18',
                    800: '#8f631a',
                    900: '#755118',
                    950: '#432c0a',
                },
                accent: {
                    50: '#ecfdf5',
                    100: '#d1fae5',
                    200: '#a7f3d0',
                    300: '#6ee7b7',
                    400: '#34d399',
                    500: '#10b981',
                    600: '#059669',
                    700: '#047857',
                    800: '#065f46',
                    900: '#064e3b',
                    950: '#022c22',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Playfair Display', 'Georgia', 'serif'],
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(30px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-6px)' },
                },
                glow: {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(232, 185, 49, 0.15)' },
                    '50%': { boxShadow: '0 0 40px rgba(232, 185, 49, 0.3)' },
                },
            },
            animation: {
                fadeIn: 'fadeIn 0.5s ease-out forwards',
                slideUp: 'slideUp 0.6s ease-out forwards',
                shimmer: 'shimmer 2s linear infinite',
                float: 'float 3s ease-in-out infinite',
                glow: 'glow 2s ease-in-out infinite',
            },
            boxShadow: {
                'luxury': '0 4px 30px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
                'luxury-lg': '0 10px 50px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06)',
                'luxury-xl': '0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 20px rgba(0, 0, 0, 0.08)',
                'gold-glow': '0 4px 30px rgba(232, 185, 49, 0.15)',
                'gold-glow-lg': '0 8px 40px rgba(232, 185, 49, 0.2)',
            },
        },
    },
    plugins: [],
};
