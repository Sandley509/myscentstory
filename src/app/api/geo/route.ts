import { currencyForCountry } from '@/lib/currency';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * The visitor's country, from the headers your host adds (Vercel, Cloudflare,
 * Netlify, CloudFront). Nothing is stored. Returns country null locally.
 */
export function GET(req: NextRequest) {
  const h = req.headers;
  const raw =
    h.get('x-vercel-ip-country') ??
    h.get('cf-ipcountry') ??
    h.get('x-nf-country') ??
    h.get('cloudfront-viewer-country') ??
    h.get('x-country-code') ??
    '';
  const country = /^[A-Z]{2}$/i.test(raw) && !['XX', 'T1'].includes(raw.toUpperCase()) ? raw.toUpperCase() : null;
  return NextResponse.json(
    { country, currency: currencyForCountry(country) },
    { headers: { 'Cache-Control': 'private, no-store', Vary: '*' } }
  );
}
