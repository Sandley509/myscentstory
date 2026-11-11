import { startCheckout } from '@/lib/commerce/checkout';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /checkout — plain-link entry point (the cart's `checkoutUrl`).
 * Creates a Stripe Checkout Session for the current cart and redirects to it.
 */
export async function GET(req: NextRequest) {
  try {
    const result = await startCheckout();
    if (result.ok) return NextResponse.redirect(result.url, 303);
    const back = new URL('/', req.url);
    back.searchParams.set('checkout_error', result.error);
    return NextResponse.redirect(back, 303);
  } catch (e) {
    console.error('[checkout] GET failed:', e);
    const back = new URL('/', req.url);
    back.searchParams.set('checkout_error', 'Checkout is unavailable right now.');
    return NextResponse.redirect(back, 303);
  }
}
