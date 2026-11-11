import { currencyForCountry } from '@/lib/currency';
import { countryFromHeaders } from '@/lib/geo';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * The visitor's country, from the headers your host adds (Vercel, Cloudflare,
 * Netlify, CloudFront). Nothing is stored. Returns country null locally.
 */
export function GET(req: NextRequest) {
  const country = countryFromHeaders(req.headers);
  return NextResponse.json(
    { country, currency: currencyForCountry(country) },
    { headers: { 'Cache-Control': 'private, no-store', Vary: '*' } }
  );
}
