/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 dev blocks cross-origin chunks (403) → silent hydration death
  allowedDevOrigins: ['localhost', '127.0.0.1', '*.localhost'],
};

export default nextConfig;
