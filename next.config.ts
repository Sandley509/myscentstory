import type { NextConfig } from 'next';

// Product images and customer uploads are served from Supabase Storage.
const supabase = (() => {
  try {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
    // http is only for a Supabase running on your own computer (supabase start).
    return u ? { hostname: u.hostname, port: u.port, protocol: u.protocol === 'http:' ? ('http' as const) : ('https' as const) } : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      ...(supabase ? [{ ...supabase, pathname: '/storage/v1/object/public/**' }] : []),
      // Covers hosted Supabase projects generally; add your own CDN here.
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' }
    ]
  },
  experimental: {
    serverActions: { bodySizeLimit: '4mb' }
  }
};

export default nextConfig;
