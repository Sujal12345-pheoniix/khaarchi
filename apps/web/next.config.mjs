/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@homeexpense/shared'],
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
