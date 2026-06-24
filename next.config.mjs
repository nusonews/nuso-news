/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        destination: '/api/well-known/apple',
      },
      {
        source: '/.well-known/assetlinks.json',
        destination: '/api/well-known/android',
      },
    ];
  },
};

export default nextConfig;
