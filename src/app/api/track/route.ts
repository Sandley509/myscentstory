import { CART_COOKIE } from '@/lib/commerce';
import { isCrawler } from '@/lib/currency';
import { countryFromHeaders } from '@/lib/geo';
import { createServiceClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/env';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "google.com" from "https://www.google.com/search?q=…"; null for links inside the store. */
function referrerHost(raw: unknown, ownHost: string): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, '').toLowerCase();
    if (!host || host === ownHost.replace(/^www\./, '')) return null;
    // Group the big ones so the report stays readable.
    if (/(^|\.)google\./.test(host)) return 'google.com';
    if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(host) || host === 'l.facebook.com' || host === 'm.facebook.com') return 'facebook.com';
    if (/(^|\.)instagram\.com$/.test(host)) return 'instagram.com';
    if (/(^|\.)(t\.co|twitter\.com|x\.com)$/.test(host)) return 'x.com';
    if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok.com';
    if (/(^|\.)bing\.com$/.test(host)) return 'bing.com';
    return host.slice(0, 100);
  } catch {
    return null;
  }
}

function deviceFrom(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Store analytics beacon, called by the storefront on every page view and
 * every 30 seconds while the tab is open (for the live view). Stores no IP
 * address and no user agent: only a device class and the country.
 */
export async function POST(req: NextRequest) {
  const done = new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  if (!supabaseConfigured) return done;

  const ua = req.headers.get('user-agent') ?? '';
  if (!ua || isCrawler(ua)) return done;

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return done;
  }
  const { sid, vid, path, ref, type } = body;
  if (typeof sid !== 'string' || !UUID.test(sid) || typeof vid !== 'string' || !UUID.test(vid)) return done;
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('/admin') || path.startsWith('/api')) return done;

  const cart = req.cookies.get(CART_COOKIE)?.value;
  try {
    const db = createServiceClient();
    const { error } = await db.rpc('analytics_record', {
      p_session: sid,
      p_visitor: vid,
      p_path: path.split('#')[0]!.slice(0, 300),
      p_referrer: referrerHost(ref, req.nextUrl.hostname),
      p_country: countryFromHeaders(req.headers),
      p_device: deviceFrom(ua),
      p_cart: cart && UUID.test(cart) ? cart : null,
      p_view: type !== 'ping'
    });
    // Missing migration: stay quiet, the store must never break over stats.
    if (error && !/analytics_record/.test(error.message)) console.error('[track]', error.message);
    // Now and then, drop stats older than about 13 months.
    if (Math.random() < 0.001) await db.rpc('analytics_purge');
  } catch (e) {
    console.error('[track]', e instanceof Error ? e.message : e);
  }
  return done;
}
