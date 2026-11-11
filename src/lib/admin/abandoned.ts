import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/** A cart counts as abandoned after an hour without changes, for up to 30 days. */
export const ABANDONED_AFTER_MS = 60 * 60 * 1000;
export const ABANDONED_WINDOW_DAYS = 30;

export type AbandonedItem = {
  title: string;
  variantTitle: string | null;
  quantity: number;
  price: number;
  imageUrl: string | null;
  handle: string | null;
};

export type AbandonedCart = {
  id: string;
  email: string | null;
  /** Where the email came from. */
  emailSource: 'cart' | 'checkout' | null;
  activityAt: string;
  createdAt: string;
  reachedCheckout: boolean;
  reminderSentAt: string | null;
  discountCode: string | null;
  items: AbandonedItem[];
  value: number;
};

type Row = {
  id: string;
  email: string | null;
  discount_code: string | null;
  activity_at: string;
  created_at: string;
  recovery_email_sent_at: string | null;
  checkouts: { email: string | null; created_at: string }[] | null;
  cart_lines: {
    quantity: number;
    product_variants: {
      title: string | null;
      price: number | string;
      products: { title: string; handle: string; product_images: { url: string; position: number }[] | null } | null;
    } | null;
  }[];
};

const SELECT =
  'id, email, discount_code, activity_at, created_at, recovery_email_sent_at, checkouts(email, created_at), cart_lines!inner(quantity, product_variants(title, price, products(title, handle, product_images(url, position))))';

function shape(r: Row): AbandonedCart {
  const items = r.cart_lines
    .filter((l) => l.product_variants?.products)
    .map((l) => {
      const v = l.product_variants!;
      const p = v.products!;
      const img = [...(p.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
      return {
        title: p.title,
        variantTitle: v.title && v.title !== 'Default Title' ? v.title : null,
        quantity: l.quantity,
        price: Number(v.price),
        imageUrl: img?.url ?? null,
        handle: p.handle
      };
    });
  const checkouts = [...(r.checkouts ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const checkoutEmail = checkouts.find((c) => c.email)?.email ?? null;
  return {
    id: r.id,
    email: r.email ?? checkoutEmail,
    emailSource: r.email ? 'cart' : checkoutEmail ? 'checkout' : null,
    activityAt: r.activity_at,
    createdAt: r.created_at,
    reachedCheckout: checkouts.length > 0,
    reminderSentAt: r.recovery_email_sent_at,
    discountCode: r.discount_code,
    items,
    value: items.reduce((s, i) => s + i.price * i.quantity, 0)
  };
}

/** Open carts with items that nobody touched for an hour, newest first. */
export async function loadAbandonedCarts(db: SupabaseClient, limit = 200) {
  const now = Date.now();
  const { data, error } = await db
    .from('carts')
    .select(SELECT)
    .eq('status', 'open')
    .lt('activity_at', new Date(now - ABANDONED_AFTER_MS).toISOString())
    .gt('activity_at', new Date(now - ABANDONED_WINDOW_DAYS * 86_400_000).toISOString())
    .order('activity_at', { ascending: false })
    .limit(limit);
  if (error) return { carts: [] as AbandonedCart[], error: error.message };
  return { carts: (data as unknown as Row[]).map(shape).filter((c) => c.items.length), error: null };
}

export async function loadAbandonedCart(db: SupabaseClient, id: string) {
  const { data, error } = await db.from('carts').select(SELECT).eq('id', id).eq('status', 'open').maybeSingle();
  if (error) throw new Error(error.message);
  return data ? shape(data as unknown as Row) : null;
}
