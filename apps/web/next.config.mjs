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
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_INTERNAL_URL || 'http://localhost:4000'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
