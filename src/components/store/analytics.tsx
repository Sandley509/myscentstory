'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useState } from 'react';

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const STORAGE_KEY = 'mss-cookie-consent';

type Consent = 'granted' | 'denied';

/**
 * Loads Google Tag Manager, Google (GA4 / Ads) and the Meta Pixel — but only
 * after the visitor accepts. Nothing is requested from Google or Meta before
 * that, which is what Quebec's Law 25 and the GDPR expect for advertising
 * cookies.
 *
 * With a GTM container you normally configure GA4 inside GTM and leave
 * NEXT_PUBLIC_GA_ID empty, or page views get counted twice.
 *
 * Renders nothing at all until at least one ID is set in the environment.
 */
export function Analytics() {
  const [consent, setConsent] = useState<Consent | null | undefined>(undefined);
  const pathname = usePathname();

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage blocked (private mode): ask again each visit.
    }
    setConsent(stored === 'granted' || stored === 'denied' ? stored : null);
  }, []);

  // Client-side navigations don't reload the pixel, so report them by hand.
  useEffect(() => {
    if (consent !== 'granted') return;
    (window as Window & { fbq?: (...a: unknown[]) => void }).fbq?.('track', 'PageView');
  }, [pathname, consent]);

  if (!GTM_ID && !GA_ID && !ADS_ID && !PIXEL_ID) return null;

  const choose = (value: Consent) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ignore — the choice still applies for this page view.
    }
    setConsent(value);
  };

  const googleId = GA_ID || ADS_ID;

  return (
    <>
      {consent === 'granted' && GTM_ID && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      )}
      {consent === 'granted' && googleId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${googleId}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());${
              GA_ID ? `gtag('config','${GA_ID}');` : ''
            }${ADS_ID ? `gtag('config','${ADS_ID}');` : ''}`}
          </Script>
        </>
      )}
      {consent === 'granted' && PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
        </Script>
      )}

      {consent === null && (
        <div
          role="dialog"
          aria-label="Cookie preferences"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-page px-4 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl text-sm text-muted">
              We use cookies to measure visits and show you relevant ads. You can accept or decline; the store works
              either way.{' '}
              <Link href="/pages/privacy" className="underline">
                Privacy policy
              </Link>
            </p>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => choose('denied')} className="btn-outline min-h-10! px-5!">
                Decline
              </button>
              <button type="button" onClick={() => choose('granted')} className="btn-solid min-h-10! px-5!">
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
