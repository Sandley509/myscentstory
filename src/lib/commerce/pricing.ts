import type { DiscountRow, StoreSettingsRow } from './db';

export const toNumber = (v: number | string | null | undefined): number =>
  v === null || v === undefined || v === '' ? 0 : Number(v);

/** Round to cents without floating-point drift. */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const toCents = (n: number): number => Math.round(n * 100);

export type DiscountEvaluation =
  | { ok: true; amount: number; freeShipping: boolean }
  | { ok: false; error: string };

/**
 * Validates a discount against a subtotal. Pure — used by the cart drawer
 * (to show the saving) and again at checkout (authoritative).
 */
export function evaluateDiscount(
  discount: DiscountRow | null | undefined,
  subtotal: number,
  now: Date = new Date()
): DiscountEvaluation {
  if (!discount || !discount.active) return { ok: false, error: 'That code isn’t valid.' };
  if (new Date(discount.starts_at) > now) return { ok: false, error: 'That code isn’t active yet.' };
  if (discount.ends_at && new Date(discount.ends_at) < now)
    return { ok: false, error: 'That code has expired.' };
  if (discount.usage_limit !== null && discount.usage_count >= discount.usage_limit)
    return { ok: false, error: 'That code has reached its usage limit.' };

  const min = toNumber(discount.min_subtotal);
  if (min > 0 && subtotal < min)
    return { ok: false, error: `Spend ${min.toFixed(2)} or more to use this code.` };

  const value = toNumber(discount.value);
  switch (discount.type) {
    case 'percentage':
      return { ok: true, amount: round2(subtotal * Math.min(value, 100) / 100), freeShipping: false };
    case 'fixed_amount':
      return { ok: true, amount: round2(Math.min(value, subtotal)), freeShipping: false };
    case 'free_shipping':
      return { ok: true, amount: 0, freeShipping: true };
  }
}

/** Shipping for a subtotal, honouring the free-shipping threshold. */
export function shippingFor(settings: StoreSettingsRow, subtotal: number, freeShipping = false): number {
  if (freeShipping) return 0;
  const threshold = toNumber(settings.free_shipping_threshold);
  if (threshold > 0 && subtotal >= threshold) return 0;
  return round2(toNumber(settings.shipping_flat_rate));
}
