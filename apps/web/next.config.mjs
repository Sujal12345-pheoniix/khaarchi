/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@homeexpense/shared',
    '@homeexpense/types',
    '@homeexpense/validation',
    '@homeexpense/financial-core',
    '@homeexpense/ui',
    '@homeexpense/config',
  ],
  async rewrites() {
    const rawInternal = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const cleanInternal = rawInternal.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
    return [
      {
        source: '/api/v1/:path*',
        destination: `${cleanInternal}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
