import { CART_COOKIE } from '@/lib/commerce';
import { verifyCartToken } from '@/lib/commerce/order-link';
import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Link from a cart reminder email: puts the saved cart back in this browser
 * and opens it. The token proves the link came from us.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('c') ?? '';
  const token = req.nextUrl.searchParams.get('t');
  const home = new URL('/', req.url);
  if (!UUID.test(id) || !verifyCartToken(id, token)) return NextResponse.redirect(home);

  const { data } = await createServiceClient().from('carts').select('id, status').eq('id', id).maybeSingle();
  if (!data || data.status !== 'open') {
    // Already bought (or gone): the store, not an empty cart.
    return NextResponse.redirect(home);
  }

  const res = NextResponse.redirect(new URL('/?cart=open', req.url));
  res.cookies.set(CART_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
  return res;
}
