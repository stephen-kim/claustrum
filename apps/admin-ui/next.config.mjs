/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

if (!process.env.NEXT_PUBLIC_MEMORY_CORE_URL) {
  console.error(
    '[admin-ui] NEXT_PUBLIC_MEMORY_CORE_URL is not set. Configure a browser-reachable memory-core URL.'
  );
}

export default nextConfig;
