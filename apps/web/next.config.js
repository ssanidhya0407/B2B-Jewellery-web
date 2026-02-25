/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '9000',
                pathname: '/jewellery-images/**',
            },
            {
                protocol: 'http',
                hostname: '127.0.0.1',
                port: '9000',
                pathname: '/jewellery-images/**',
            },
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'plus.unsplash.com',
                pathname: '/**',
            },
        ],
    },
};

module.exports = nextConfig;
