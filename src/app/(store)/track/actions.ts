'use server';

import { findOrderLink } from '@/lib/commerce/track-lookup';
import { headers } from 'next/headers';

// Best-effort brake on guessing order numbers: 8 lookups per 10 minutes per IP
// (per server instance). The email must match as well, which is the real lock.
const attempts = new Map<string, number[]>();
const WINDOW = 10 * 60_000;
const LIMIT = 8;

export async function lookupOrder(_: unknown, form: FormData): Promise<{ error?: string; url?: string }> {
  const ip = ((await headers()).get('x-forwarded-for') ?? 'local').split(',')[0]!.trim();
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (recent.length >= LIMIT) return { error: 'Too many attempts. Please wait a few minutes and try again.' };
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 5000) attempts.clear();

  const order = String(form.get('order') ?? '').slice(0, 20);
  const email = String(form.get('email') ?? '').slice(0, 254);
  if (!order.trim() || !email.trim()) return { error: 'Enter your order number and email.' };
  try {
    const url = await findOrderLink(order, email);
    if (!url) return { error: 'We couldn’t find an order with that number and email. Check your confirmation email and try again.' };
    return { url };
  } catch (e) {
    console.error('[track]', e);
    return { error: 'Order tracking is unavailable right now. Please try again shortly.' };
  }
}
