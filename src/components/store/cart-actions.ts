'use server';

import { addToCart, getCart, removeFromCart, setCartDiscount, subscribeToNewsletter, attachEmailToCart, updateCart } from '@/lib/commerce';
import { startCheckout } from '@/lib/commerce/checkout';
import type { AttributeInput, Cart } from '@/lib/commerce/types';
import { TAGS } from '@/lib/constants';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

export type CartResult = { ok: boolean; error?: string; cart?: Cart; needsEmail?: boolean };

/**
 * Every cart action RETURNS the authoritative cart and the client adopts it.
 * Never rely on a layout re-render after a server action — layouts do not
 * re-render, which is the classic "item added but cart looks empty" bug.
 */

const fail = (e: unknown, fallback: string): CartResult => {
  console.error('[cart]', e);
  return { ok: false, error: e instanceof Error && e.message ? e.message : fallback };
};

export async function addItem(input: {
  variantId: string;
  quantity?: number;
  attributes?: AttributeInput[];
}): Promise<CartResult> {
  if (!input.variantId) return { ok: false, error: 'Choose an option first.' };
  try {
    const cart = await addToCart([
      {
        merchandiseId: input.variantId,
        quantity: Math.min(Math.max(Math.trunc(input.quantity ?? 1), 1), 100),
        ...(input.attributes?.length ? { attributes: input.attributes } : {})
      }
    ]);
    revalidateTag(TAGS.cart);
    return { ok: true, cart };
  } catch (e) {
    return fail(e, 'Could not add that to your cart.');
  }
}

export async function updateLineQuantity(input: {
  lineId: string;
  variantId: string;
  quantity: number;
}): Promise<CartResult> {
  try {
    const cart =
      input.quantity <= 0
        ? await removeFromCart([input.lineId])
        : await updateCart([{ id: input.lineId, merchandiseId: input.variantId, quantity: input.quantity }]);
    revalidateTag(TAGS.cart);
    return { ok: true, cart };
  } catch (e) {
    return fail(e, 'Could not update the quantity.');
  }
}

export async function removeLine(lineId: string): Promise<CartResult> {
  try {
    const cart = await removeFromCart([lineId]);
    revalidateTag(TAGS.cart);
    return { ok: true, cart };
  } catch (e) {
    return fail(e, 'Could not remove that item.');
  }
}

/** Apply a discount code; pass an empty string to clear it. */
export async function applyDiscount(code: string, email?: string): Promise<CartResult> {
  try {
    const { cart, error, needsEmail } = await setCartDiscount(
      String(code ?? '').slice(0, 64),
      email ? String(email).slice(0, 254) : undefined
    );
    if (error) return { ok: false, error, needsEmail };
    revalidateTag(TAGS.cart);
    return { ok: true, cart };
  } catch (e) {
    return fail(e, 'Could not apply that code.');
  }
}

/** Re-read the cart (used once on mount so a reload shows true contents). */
export async function refreshCart(): Promise<Cart | undefined> {
  try {
    return await getCart();
  } catch (e) {
    console.error('[cart] refresh failed:', e);
    return undefined;
  }
}

/**
 * Freeze the cart, create a Stripe Checkout Session and send the customer to
 * it. `redirect()` throws internally, so it must stay OUTSIDE the try/catch.
 */
export async function checkout(): Promise<{ ok: false; error: string } | void> {
  let url: string;
  try {
    const cart = await getCart();
    if (!cart?.lines.length) return { ok: false, error: 'Your cart is empty.' };
    const result = await startCheckout();
    if (!result.ok) return result;
    url = result.url;
  } catch (e) {
    console.error('[checkout]', e);
    return { ok: false, error: 'We couldn’t reach checkout. Please try again.' };
  }
  redirect(url);
}

/** Newsletter sign-up from the footer. */
export async function subscribe(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await subscribeToNewsletter(email);
    if (res.ok) await attachEmailToCart(email).catch(() => undefined);
    return res;
  } catch (e) {
    console.error('[newsletter]', e);
    return { ok: false, error: 'We couldn’t sign you up right now. Please try again.' };
  }
}
