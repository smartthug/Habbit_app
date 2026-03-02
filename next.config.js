/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server Actions are enabled by default in Next.js 14+
  // Optimize for Vercel deployment
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Ensure middleware works correctly
  reactStrictMode: true,
};

module.exports = nextConfig;
