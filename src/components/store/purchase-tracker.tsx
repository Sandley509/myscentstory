'use client';

import { trackPurchase, type TrackItem } from '@/lib/track';
import { useEffect } from 'react';

/** Reports the sale to Google and Meta once per order, even if the page is reloaded. */
export function PurchaseTracker(props: { id: string; value: number; currency: string; shipping: number; tax: number; items: TrackItem[] }) {
  useEffect(() => {
    const key = `mss-purchase-${props.id}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Storage unavailable: report anyway.
    }
    // The tags load right after hydration; give them a moment before sending.
    const timer = window.setTimeout(() => trackPurchase(props), 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.id]);
  return null;
}
