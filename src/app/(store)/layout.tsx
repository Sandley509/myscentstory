import { Analytics } from '@/components/store/analytics';
import { CartProvider } from '@/components/store/cart-context';
import { CurrencyProvider } from '@/components/store/currency';
import { Footer } from '@/components/store/footer';
import { Header } from '@/components/store/header';
import { JsonLd } from '@/components/store/json-ld';
import { VisitTracker } from '@/components/store/visit-tracker';
import { WelcomeOffer } from '@/components/store/welcome-offer';
import { getCollections, getSiteContent, getStoreSettings } from '@/lib/commerce';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo';
import type { ReactNode } from 'react';

/**
 * Storefront chrome.
 *
 * The cart is deliberately NOT read here: reading the cart cookie would force
 * every page to render per-request. <CartProvider> loads it in the browser
 * instead, so catalogue pages can be cached and served instantly — page speed
 * is a ranking signal and a Google Ads quality factor.
 */
export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [collections, settings, content] = await Promise.all([
    getCollections().catch((e) => {
      console.error('[store layout] collections:', e instanceof Error ? e.message : e);
      return [];
    }),
    getStoreSettings(),
    getSiteContent()
  ]);

  return (
    <CurrencyProvider base={settings.currency}>
      <CartProvider>
        <JsonLd data={[organizationJsonLd(settings, content.social), websiteJsonLd(settings)]} />
        <div className="store-root flex min-h-screen flex-col">
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-page focus:p-3">
            Skip to content
          </a>
          <Header settings={settings} collections={collections} announcement={content.announcement} menu={content.nav} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer settings={settings} collections={collections} social={content.social} />
        </div>
        <WelcomeOffer offer={content.welcome} />
        <Analytics />
        <VisitTracker />
      </CartProvider>
    </CurrencyProvider>
  );
}
