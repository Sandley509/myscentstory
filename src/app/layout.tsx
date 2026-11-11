import '@fontsource-variable/jost';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SITE, siteUrl } from '@/lib/site';
import './globals.css';

const storeName = process.env.NEXT_PUBLIC_STORE_NAME || SITE.name;
const defaultTitle = `${storeName} | Perfumes for Her & Him`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: defaultTitle, template: `%s | ${storeName}` },
  description: SITE.description,
  applicationName: storeName,
  openGraph: {
    type: 'website',
    siteName: storeName,
    locale: SITE.locale,
    title: defaultTitle,
    description: SITE.description,
    url: siteUrl,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: `${storeName} Perfumes` }]
  },
  twitter: { card: 'summary_large_image' },
  // Paste the codes Google Search Console / Merchant Center and Meta give you
  // into .env.local to prove you own the domain.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION
      ? { 'facebook-domain-verification': process.env.NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION }
      : undefined
  }
};

export const viewport: Viewport = { themeColor: '#ffffff' };

/**
 * Root layout: only <html>/<body>. The storefront chrome lives in
 * `(store)/layout.tsx` and the admin has its own shell, so the two never
 * bleed into each other.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={SITE.language} suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
