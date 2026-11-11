import { getStoreSettings } from '@/lib/commerce';
import { NextResponse } from 'next/server';

/**
 * Exchange rates from the store currency, refreshed every 6 hours.
 * Source: ExchangeRate-API's free open endpoint (daily rates, attribution
 * required, shown under the currency picker). Override with EXCHANGE_RATES_URL
 * ({base} is replaced by the store currency) to use another provider.
 */
export const revalidate = 21600;

export async function GET() {
  const { currency } = await getStoreSettings();
  const base = currency.toUpperCase();
  const url = (process.env.EXCHANGE_RATES_URL || 'https://open.er-api.com/v6/latest/{base}').replace('{base}', base);
  try {
    const res = await fetch(url, { next: { revalidate: 21600 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { rates?: Record<string, number>; time_last_update_utc?: string };
    if (!data.rates || typeof data.rates !== 'object') throw new Error('No rates in response');
    const rates = Object.fromEntries(
      Object.entries(data.rates).filter(([k, v]) => /^[A-Z]{3}$/.test(k) && typeof v === 'number' && v > 0)
    );
    return NextResponse.json(
      { base, rates: { ...rates, [base]: 1 }, updated: data.time_last_update_utc ?? null },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } }
    );
  } catch (e) {
    console.error('[rates]', e instanceof Error ? e.message : e);
    // No rates: the shop simply keeps showing the store currency.
    return NextResponse.json({ base, rates: { [base]: 1 }, updated: null }, { headers: { 'Cache-Control': 'public, s-maxage=300' } });
  }
}
