/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow API calls to the Python service if hosted separately in production
  async rewrites() {
    return [
      {
        source: '/api/nlp/:path*',
        destination: 'http://localhost:8000/:path*',
      },
    ];
  },
};

export default nextConfig;