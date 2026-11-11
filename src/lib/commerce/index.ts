/**
 * Storefront data layer — Supabase edition.
 *
 * Same exported API as the old `lib/shopify` module (getProduct, getCart,
 * addToCart, …) so pages and components did not need to change. Catalog reads
 * use the anon key (RLS only exposes active products); cart writes use the
 * service-role key on the server.
 */
import 'server-only';

import { HIDDEN_PRODUCT_TAG, TAGS } from '@/lib/constants';
import { DEFAULT_CONTENT, normalizeContent, type SiteContent } from '@/lib/content';
import { createPublicClient, createServiceClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/env';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { cache } from 'react';
import type {
  DiscountRow,
  ProductImageRow,
  ProductWithRelations,
  StoreSettingsRow,
  VariantRow
} from './db';
import {
  mockCart,
  mockCollectionProducts,
  mockCollections,
  mockProducts,
  mockSearch
} from './mock';
import { evaluateDiscount, round2, toNumber } from './pricing';
import type {
  Cart,
  CartItem,
  CartLineInput,
  Collection,
  Image,
  Menu,
  Money,
  Product,
  ProductVariant
} from './types';

/** True when Supabase isn't configured — the storefront falls back to demo data. */
export const usingMockData = !supabaseConfigured;

if (usingMockData && process.env.NODE_ENV !== 'production') {
  console.warn(
    '\n\x1b[33m⚠  NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set — running on demo data.\x1b[0m\n'
  );
}

export const CART_COOKIE = 'cartId';
export const CHECKOUT_PATH = '/checkout';

const PRODUCT_SELECT = '*, product_images(*), product_variants(*)';

const PLACEHOLDER_IMAGE: Image = {
  url: '/placeholder.svg',
  altText: '',
  width: 800,
  height: 800
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string | undefined | null): v is string => !!v && UUID_RE.test(v);

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: StoreSettingsRow = {
  id: 1,
  store_name: process.env.NEXT_PUBLIC_STORE_NAME || 'MyScentStory',
  contact_email: 'support@myscentstory.net',
  phone: null,
  currency: 'CAD',
  address: {},
  shipping_flat_rate: 25,
  free_shipping_threshold: 600,
  stripe_automatic_tax: false,
  allowed_countries: ['WORLD']
};

/** Store settings, fetched once per request. */
export const getStoreSettings = cache(async (): Promise<StoreSettingsRow> => {
  if (usingMockData) return DEFAULT_SETTINGS;
  const { data, error } = await createPublicClient()
    .from('store_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) console.error('[commerce] settings:', error.message);
  return (data as StoreSettingsRow) ?? DEFAULT_SETTINGS;
});

/**
 * Banner, announcement bar and other copy edited in /admin → Online store.
 * Falls back to the built-in defaults when the table is empty or missing.
 */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  if (usingMockData) return DEFAULT_CONTENT;
  const { data, error } = await createPublicClient()
    .from('site_content')
    .select('content')
    .eq('id', 1)
    .maybeSingle();
  if (error) console.error('[commerce] site content:', error.message);
  return normalizeContent(data?.content);
});

const money = (amount: number, currencyCode: string): Money => ({
  amount: round2(amount).toFixed(2),
  currencyCode
});

// ---------------------------------------------------------------------------
// Reshaping DB rows → storefront types
// ---------------------------------------------------------------------------

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const sortByPosition = <T extends { position: number }>(rows: T[] | null | undefined) =>
  [...(rows ?? [])].sort((a, b) => a.position - b.position);

const toImage = (row: ProductImageRow, title: string): Image => ({
  url: row.url,
  altText: row.alt || title,
  width: row.width ?? 1200,
  height: row.height ?? 1200
});

export const variantAvailable = (v: Pick<VariantRow, 'track_inventory' | 'continue_selling' | 'inventory_quantity'>) =>
  !v.track_inventory || v.continue_selling || v.inventory_quantity > 0;

/** Shopify convention: products without options expose one "Title / Default Title" option. */
function productOptions(p: ProductWithRelations) {
  const opts = (p.options ?? []).filter((o) => o?.name && o.values?.length);
  return opts.length ? opts : [{ name: 'Title', values: ['Default Title'] }];
}

function reshapeVariant(v: VariantRow, p: ProductWithRelations, currency: string): ProductVariant {
  const opts = productOptions(p);
  const values = [v.option1, v.option2, v.option3];
  return {
    id: v.id,
    title: v.title || 'Default Title',
    availableForSale: variantAvailable(v),
    selectedOptions: opts.map((o, i) => ({
      name: o.name,
      value: values[i] ?? (o.name === 'Title' ? 'Default Title' : '')
    })),
    price: money(toNumber(v.price), currency),
    compareAtPrice:
      toNumber(v.compare_at_price) > toNumber(v.price) ? money(toNumber(v.compare_at_price), currency) : null,
    sku: v.sku ?? null,
    barcode: v.barcode?.trim() || null
  };
}

function reshapeProduct(
  p: ProductWithRelations | null | undefined,
  currency: string,
  filterHidden = true
): Product | undefined {
  if (!p) return undefined;
  if (filterHidden && p.tags?.includes(HIDDEN_PRODUCT_TAG)) return undefined;

  const images = sortByPosition(p.product_images).map((img) => toImage(img, p.title));
  const variants = sortByPosition(p.product_variants).map((v) => reshapeVariant(v, p, currency));
  const prices = variants.map((v) => Number(v.price.amount));
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  const description = stripHtml(p.description_html ?? '');

  return {
    id: p.id,
    handle: p.handle,
    availableForSale: variants.some((v) => v.availableForSale),
    title: p.title,
    description,
    descriptionHtml: p.description_html ?? '',
    options: productOptions(p).map((o) => ({ id: `${p.id}-${o.name}`, name: o.name, values: o.values })),
    priceRange: { minVariantPrice: money(min, currency), maxVariantPrice: money(max, currency) },
    variants,
    featuredImage: images[0] ?? PLACEHOLDER_IMAGE,
    images,
    seo: {
      title: p.seo_title || p.title,
      description: p.seo_description || description.slice(0, 160)
    },
    tags: p.tags ?? [],
    vendor: p.vendor ?? null,
    productType: p.product_type ?? null,
    gender: p.gender ?? null,
    concentration: p.concentration ?? null,
    scentFamily: p.scent_family ?? null,
    notes: { top: p.top_notes ?? [], heart: p.heart_notes ?? [], base: p.base_notes ?? [] },
    totalSold: p.total_sold ?? 0,
    createdAt: p.created_at,
    updatedAt: p.updated_at
  };
}

const reshapeProducts = (rows: ProductWithRelations[] | null, currency: string): Product[] =>
  (rows ?? []).map((r) => reshapeProduct(r, currency)).filter((p): p is Product => !!p);

type CollectionDb = {
  handle: string;
  title: string;
  description: string;
  image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string;
};

const reshapeCollection = (c: CollectionDb): Collection => ({
  handle: c.handle,
  title: c.title,
  description: c.description ?? '',
  image: c.image_url ? { url: c.image_url, altText: c.title, width: 1200, height: 1200 } : null,
  seo: { title: c.seo_title || c.title, description: c.seo_description || c.description || '' },
  updatedAt: c.updated_at,
  path: `/collections/${c.handle}`
});

/** Demo-data equivalent of the SQL ordering, so sorting works before Supabase exists. */
function sortMock(products: Product[], sortKey?: string, reverse?: boolean): Product[] {
  const list = [...products];
  if (sortKey === 'MANUAL') return reverse ? list.reverse() : list;
  if (sortKey === 'BEST_SELLING') return list.sort((a, b) => b.totalSold - a.totalSold);
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return sortProducts(list, sortKey, reverse);
}

function sortProducts(products: Product[], sortKey?: string, reverse?: boolean): Product[] {
  const list = [...products];
  if (sortKey === 'PRICE') {
    list.sort((a, b) => Number(a.priceRange.minVariantPrice.amount) - Number(b.priceRange.minVariantPrice.amount));
    if (reverse) list.reverse();
  } else if (sortKey === 'CREATED_AT' || sortKey === 'CREATED') {
    // Rows arrive newest-first; "Latest arrivals" uses reverse=true.
    if (!reverse) list.reverse();
  }
  return list;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function getProduct(handle: string): Promise<Product | undefined> {
  if (usingMockData) {
    return mockProducts.find((p) => p.handle === handle);
  }
  const [{ currency }, { data, error }] = await Promise.all([
    getStoreSettings(),
    createPublicClient().from('products').select(PRODUCT_SELECT).eq('handle', handle).maybeSingle()
  ]);
  if (error) throw new Error(`getProduct(${handle}): ${error.message}`);
  return reshapeProduct(data as ProductWithRelations | null, currency, false);
}

/** Strip characters that would break a PostgREST `or=` filter. */
const cleanSearch = (q: string) => q.replace(/[%,()*\\"':]/g, ' ').trim().slice(0, 80);

export async function getProducts({
  query,
  reverse,
  sortKey
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  if (usingMockData) return sortMock(mockSearch(query), sortKey, reverse);

  let req = createPublicClient().from('products').select(PRODUCT_SELECT);

  const q = query ? cleanSearch(query) : '';
  if (q) {
    const filters = [
      `title.ilike.%${q}%`,
      `description_html.ilike.%${q}%`,
      `product_type.ilike.%${q}%`,
      `vendor.ilike.%${q}%`
    ];
    // Exact tag match for single-word searches (e.g. "roses").
    if (!/\s/.test(q)) filters.push(`tags.cs.{${q.toLowerCase()}}`);
    req = req.or(filters.join(','));
  }

  req =
    sortKey === 'BEST_SELLING'
      ? req.order('total_sold', { ascending: false })
      : req.order('created_at', { ascending: false });

  const [{ currency }, { data, error }] = await Promise.all([getStoreSettings(), req.limit(250)]);
  if (error) throw new Error(`getProducts: ${error.message}`);
  return sortProducts(reshapeProducts(data as ProductWithRelations[], currency), sortKey, reverse);
}

export async function getProductRecommendations(productId: string): Promise<Product[]> {
  if (usingMockData) return mockProducts.filter((p) => p.id !== productId).slice(0, 4);
  if (!isUuid(productId)) return [];

  const db = createPublicClient();
  const { data: links } = await db
    .from('collection_products')
    .select('collection_id')
    .eq('product_id', productId);

  const collectionIds = (links ?? []).map((l) => l.collection_id as string);
  let ids: string[] = [];
  if (collectionIds.length) {
    const { data: siblings } = await db
      .from('collection_products')
      .select('product_id')
      .in('collection_id', collectionIds)
      .neq('product_id', productId)
      .limit(40);
    ids = [...new Set((siblings ?? []).map((s) => s.product_id as string))];
  }

  let req = db.from('products').select(PRODUCT_SELECT).neq('id', productId);
  req = ids.length ? req.in('id', ids.slice(0, 12)) : req.order('total_sold', { ascending: false });

  const [{ currency }, { data }] = await Promise.all([getStoreSettings(), req.limit(8)]);
  return reshapeProducts(data as ProductWithRelations[], currency).slice(0, 4);
}

// ---------------------------------------------------------------------------
// Collections & menu
// ---------------------------------------------------------------------------

export async function getCollection(handle: string): Promise<Collection | undefined> {
  if (usingMockData) return mockCollections.find((c) => c.handle === handle);
  const { data, error } = await createPublicClient()
    .from('collections')
    .select('*')
    .eq('handle', handle)
    .maybeSingle();
  if (error) throw new Error(`getCollection: ${error.message}`);
  return data ? reshapeCollection(data as CollectionDb) : undefined;
}

export async function getCollectionProducts({
  collection,
  reverse,
  sortKey
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  if (usingMockData) return sortMock(mockCollectionProducts(collection), sortKey || 'MANUAL', reverse);

  const db = createPublicClient();
  const { data: col } = await db.from('collections').select('id').eq('handle', collection).maybeSingle();
  if (!col) return [];

  const { data: links } = await db
    .from('collection_products')
    .select('product_id, position')
    .eq('collection_id', col.id)
    .order('position');
  const ids = (links ?? []).map((l) => l.product_id as string);
  if (!ids.length) return [];

  const [{ currency }, { data, error }] = await Promise.all([
    getStoreSettings(),
    db.from('products').select(PRODUCT_SELECT).in('id', ids)
  ]);
  if (error) throw new Error(`getCollectionProducts: ${error.message}`);

  const byId = new Map(reshapeProducts(data as ProductWithRelations[], currency).map((p) => [p.id, p]));

  if (sortKey === 'BEST_SELLING') {
    const sold = new Map((data as ProductWithRelations[]).map((r) => [r.id, r.total_sold]));
    return [...byId.values()].sort((a, b) => (sold.get(b.id) ?? 0) - (sold.get(a.id) ?? 0));
  }
  if (sortKey === 'PRICE' || sortKey === 'CREATED_AT' || sortKey === 'CREATED') {
    const created = new Map((data as ProductWithRelations[]).map((r) => [r.id, r.created_at]));
    const newestFirst = [...byId.values()].sort((a, b) =>
      (created.get(b.id) ?? '').localeCompare(created.get(a.id) ?? '')
    );
    return sortProducts(newestFirst, sortKey, reverse);
  }
  // Manual order, as arranged in the admin.
  const ordered = ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);
  return reverse ? ordered.reverse() : ordered;
}

export async function getCollections(): Promise<Collection[]> {
  if (usingMockData) return mockCollections;

  const { data, error } = await createPublicClient()
    .from('collections')
    .select('*')
    .order('sort_order')
    .order('title');
  if (error) throw new Error(`getCollections: ${error.message}`);

  return [
    {
      handle: '',
      title: 'All',
      description: 'All products',
      seo: { title: 'All', description: 'All products' },
      path: '/collections/all',
      updatedAt: new Date().toISOString()
    },
    ...(data as CollectionDb[])
      .filter((c) => !c.handle.startsWith('hidden'))
      .map(reshapeCollection)
  ];
}

export async function getMenu(): Promise<Menu[]> {
  const collections = await getCollections();
  return collections.filter((c) => c.handle).map((c) => ({ title: c.title, path: c.path }));
}

// ---------------------------------------------------------------------------
// Cart — server-managed rows keyed by the `cartId` cookie
// ---------------------------------------------------------------------------

type CartLineDb = {
  id: string;
  quantity: number;
  attributes: { key: string; value: string }[] | null;
  product_variants:
    | (VariantRow & {
        products: (ProductWithRelations & { product_images: ProductImageRow[] }) | null;
      })
    | null;
};

type CartDb = {
  id: string;
  status: 'open' | 'completed';
  discount_code: string | null;
  email: string | null;
  cart_lines: CartLineDb[];
};

const CART_SELECT =
  'id, status, discount_code, email, cart_lines(id, quantity, attributes, created_at, product_variants(*, products(*, product_images(*))))';

async function readCartCookie(): Promise<string | undefined> {
  const id = (await cookies()).get(CART_COOKIE)?.value;
  // Old Shopify cart ids (gid://shopify/Cart/…) are ignored.
  return isUuid(id) ? id : undefined;
}

async function writeCartCookie(id: string) {
  (await cookies()).set(CART_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
}

async function loadCartRow(cartId: string): Promise<CartDb | null> {
  const { data, error } = await createServiceClient()
    .from('carts')
    .select(CART_SELECT)
    .eq('id', cartId)
    .maybeSingle();
  if (error) throw new Error(`loadCart: ${error.message}`);
  return data as unknown as CartDb | null;
}

export async function findDiscount(code: string): Promise<DiscountRow | null> {
  const { data } = await createServiceClient()
    .from('discounts')
    .select('*')
    .ilike('code', code.trim())
    .maybeSingle();
  return (data as DiscountRow) ?? null;
}

async function reshapeCart(row: CartDb): Promise<Cart> {
  const { currency } = await getStoreSettings();

  const lines: CartItem[] = [...(row.cart_lines ?? [])]
    .filter((l) => l.product_variants?.products)
    .map((l) => {
      const v = l.product_variants!;
      const p = v.products!;
      const variant = reshapeVariant(v, { ...p, product_variants: [] }, currency);
      const img = sortByPosition(p.product_images)[0];
      return {
        id: l.id,
        quantity: l.quantity,
        attributes: (l.attributes ?? []).map((a) => ({ key: a.key, value: a.value })),
        cost: { totalAmount: money(toNumber(v.price) * l.quantity, currency) },
        merchandise: {
          id: v.id,
          title: variant.title,
          selectedOptions: variant.selectedOptions,
          product: {
            id: p.id,
            handle: p.handle,
            title: p.title,
            featuredImage: img ? toImage(img, p.title) : PLACEHOLDER_IMAGE,
            tags: p.tags ?? []
          }
        }
      };
    });

  const subtotal = lines.reduce((sum, l) => sum + Number(l.cost.totalAmount.amount), 0);

  let discountAmount = 0;
  if (row.discount_code) {
    const evaluation = evaluateDiscount(await findDiscount(row.discount_code), subtotal);
    if (evaluation.ok) discountAmount = evaluation.amount;
  }

  return {
    id: row.id,
    checkoutUrl: CHECKOUT_PATH,
    cost: {
      subtotalAmount: money(subtotal, currency),
      // Shipping and tax are calculated at checkout.
      totalAmount: money(Math.max(subtotal - discountAmount, 0), currency),
      totalTaxAmount: money(0, currency)
    },
    lines,
    totalQuantity: lines.reduce((n, l) => n + l.quantity, 0),
    discountCode: row.discount_code,
    email: row.email ?? null,
    discountAmount: row.discount_code ? money(discountAmount, currency) : null
  };
}

export async function createCart(): Promise<Cart> {
  if (usingMockData) return mockCart;
  const { data, error } = await createServiceClient().from('carts').insert({}).select('id').single();
  if (error) throw new Error(`createCart: ${error.message}`);
  const { currency } = await getStoreSettings();
  return {
    id: data.id,
    checkoutUrl: CHECKOUT_PATH,
    cost: {
      subtotalAmount: money(0, currency),
      totalAmount: money(0, currency),
      totalTaxAmount: money(0, currency)
    },
    lines: [],
    totalQuantity: 0
  };
}

/** Returns an open cart id, creating the cart (and cookie) when needed. */
async function ensureOpenCartId(): Promise<string> {
  const existing = await readCartCookie();
  if (existing) {
    const { data } = await createServiceClient()
      .from('carts')
      .select('id, status')
      .eq('id', existing)
      .maybeSingle();
    if (data && data.status === 'open') return existing;
  }
  const cart = await createCart();
  await writeCartCookie(cart.id!);
  return cart.id!;
}

const sameAttributes = (a: { key: string; value: string }[] = [], b: { key: string; value: string }[] = []) =>
  JSON.stringify([...a].sort((x, y) => x.key.localeCompare(y.key))) ===
  JSON.stringify([...b].sort((x, y) => x.key.localeCompare(y.key)));

export async function addToCart(lines: CartLineInput[]): Promise<Cart> {
  if (usingMockData) return mockCart;

  const db = createServiceClient();
  const cartId = await ensureOpenCartId();
  const current = await loadCartRow(cartId);

  for (const line of lines) {
    if (!isUuid(line.merchandiseId)) throw new Error('That product is no longer available.');

    const { data: variant } = await db
      .from('product_variants')
      .select('id, inventory_quantity, track_inventory, continue_selling, products!inner(status)')
      .eq('id', line.merchandiseId)
      .maybeSingle();

    const status = (variant?.products as unknown as { status: string } | null)?.status;
    if (!variant || status !== 'active') throw new Error('That product is no longer available.');

    const attributes = line.attributes ?? [];
    const existing = current?.cart_lines.find(
      (l) => l.product_variants?.id === line.merchandiseId && sameAttributes(l.attributes ?? [], attributes)
    );
    const nextQty = (existing?.quantity ?? 0) + line.quantity;

    if (variant.track_inventory && !variant.continue_selling && nextQty > variant.inventory_quantity) {
      throw new Error(
        variant.inventory_quantity > 0
          ? `Only ${variant.inventory_quantity} left in stock.`
          : 'Sorry, this item is sold out.'
      );
    }

    const { error } = existing
      ? await db.from('cart_lines').update({ quantity: nextQty }).eq('id', existing.id)
      : await db.from('cart_lines').insert({
          cart_id: cartId,
          variant_id: line.merchandiseId,
          quantity: line.quantity,
          attributes
        });
    if (error) throw new Error(`addToCart: ${error.message}`);
  }

  const row = await loadCartRow(cartId);
  return reshapeCart(row!);
}

export async function removeFromCart(lineIds: string[]): Promise<Cart> {
  if (usingMockData) return mockCart;
  const cartId = await readCartCookie();
  if (!cartId) throw new Error('Missing cart ID');

  const { error } = await createServiceClient()
    .from('cart_lines')
    .delete()
    .eq('cart_id', cartId)
    .in('id', lineIds.filter(isUuid));
  if (error) throw new Error(`removeFromCart: ${error.message}`);

  const row = await loadCartRow(cartId);
  if (!row) throw new Error('Cart not found');
  return reshapeCart(row);
}

export async function updateCart(
  lines: { id: string; merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  if (usingMockData) return mockCart;
  const cartId = await readCartCookie();
  if (!cartId) throw new Error('Missing cart ID');
  const db = createServiceClient();

  for (const line of lines) {
    if (!isUuid(line.id)) continue;
    if (line.quantity <= 0) {
      await db.from('cart_lines').delete().eq('cart_id', cartId).eq('id', line.id);
      continue;
    }
    const { data: v } = await db
      .from('product_variants')
      .select('inventory_quantity, track_inventory, continue_selling')
      .eq('id', line.merchandiseId)
      .maybeSingle();
    if (v?.track_inventory && !v.continue_selling && line.quantity > v.inventory_quantity) {
      throw new Error(`Only ${v.inventory_quantity} left in stock.`);
    }
    const { error } = await db
      .from('cart_lines')
      .update({ quantity: Math.min(line.quantity, 100) })
      .eq('cart_id', cartId)
      .eq('id', line.id);
    if (error) throw new Error(`updateCart: ${error.message}`);
  }

  const row = await loadCartRow(cartId);
  if (!row) throw new Error('Cart not found');
  return reshapeCart(row);
}

export async function getCart(): Promise<Cart | undefined> {
  if (usingMockData) return mockCart;
  const cartId = await readCartCookie();
  if (!cartId) return undefined;
  const row = await loadCartRow(cartId);
  // A completed cart has been turned into an order — the shopper starts fresh.
  if (!row || row.status !== 'open') return undefined;
  return reshapeCart(row);
}

/** True when a code is limited by customer (first order / once per customer), so it needs an email. */
export const discountNeedsEmail = (d: DiscountRow | null | undefined) => !!d && (!!d.first_order_only || d.once_per_customer);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Customer-limited codes: checks the email's order history.
 * Every order that was paid (even if later refunded) counts as a previous order.
 */
export async function checkCustomerDiscount(d: DiscountRow, email: string | null | undefined): Promise<string | null> {
  if (!discountNeedsEmail(d)) return null;
  const address = (email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(address)) return 'Enter the email you’ll use to order.';
  const { data } = await createServiceClient()
    .from('orders')
    .select('discount_code')
    .ilike('email', address)
    .in('financial_status', ['paid', 'partially_refunded', 'refunded'])
    .limit(200);
  const previous = data ?? [];
  if (d.first_order_only && previous.length) return 'This code is for first orders only, and this email has ordered before.';
  if (d.once_per_customer && previous.some((o) => (o.discount_code ?? '').toUpperCase() === d.code.toUpperCase())) {
    return 'This code has already been used with this email.';
  }
  return null;
}

/**
 * Apply (or clear, with an empty string) a discount code on the current cart.
 * `needsEmail` tells the cart to ask for the shopper's email, for first-order codes.
 */
export async function setCartDiscount(
  code: string,
  email?: string
): Promise<{ cart?: Cart; error?: string; needsEmail?: boolean }> {
  if (usingMockData) return { error: 'Discounts are unavailable in demo mode.' };
  const cartId = await readCartCookie();
  if (!cartId) return { error: 'Your cart is empty.' };
  const db = createServiceClient();
  const trimmed = code.trim().toUpperCase();
  let cartEmail: string | null | undefined;

  if (trimmed) {
    const row = await loadCartRow(cartId);
    if (!row) return { error: 'Your cart is empty.' };
    const cart = await reshapeCart({ ...row, discount_code: null });
    const discount = await findDiscount(trimmed);
    const evaluation = evaluateDiscount(discount, Number(cart.cost.subtotalAmount.amount));
    if (!evaluation.ok) return { error: evaluation.error };
    if (discountNeedsEmail(discount)) {
      const address = (email ?? row.email ?? '').trim().toLowerCase();
      if (!address) return { needsEmail: true, error: 'This code is for first orders. Enter the email you’ll order with.' };
      const problem = await checkCustomerDiscount(discount!, address);
      if (problem) return { error: problem, needsEmail: !EMAIL_RE.test(address) };
      cartEmail = address;
    }
  }

  await db
    .from('carts')
    .update({ discount_code: trimmed || null, ...(cartEmail !== undefined ? { email: cartEmail } : {}) })
    .eq('id', cartId);
  const row = await loadCartRow(cartId);
  return { cart: row ? await reshapeCart(row) : undefined };
}

/** Raw cart row for checkout (server only). */
export async function getCartForCheckout() {
  const cartId = await readCartCookie();
  if (!cartId) return null;
  const row = await loadCartRow(cartId);
  if (!row || row.status !== 'open') return null;
  return { row, cart: await reshapeCart(row) };
}

// ---------------------------------------------------------------------------
// Newsletter — a subscriber is a customer row with `accepts_marketing = true`,
// so they show up in /admin → Customers like a Shopify subscriber would.
// ---------------------------------------------------------------------------

export async function subscribeToNewsletter(rawEmail: string): Promise<{ ok: boolean; error?: string }> {
  const email = String(rawEmail ?? '').trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (usingMockData) return { ok: true };

  const db = createServiceClient();
  const { data: existing } = await db.from('customers').select('id').eq('email', email).maybeSingle();
  const { error } = existing
    ? await db.from('customers').update({ accepts_marketing: true }).eq('id', existing.id)
    : await db.from('customers').insert({ email, accepts_marketing: true, tags: ['newsletter'] });
  if (error) {
    console.error('[newsletter]', error.message);
    return { ok: false, error: 'We couldn’t sign you up right now. Please try again.' };
  }
  return { ok: true };
}

/**
 * Remembers the email a shopper gave (e.g. in the welcome popup) on their open
 * cart, so it can get a reminder if they leave without paying. Never replaces
 * an email the cart already has.
 */
export async function attachEmailToCart(rawEmail: string): Promise<void> {
  if (usingMockData) return;
  const email = String(rawEmail ?? '').trim().toLowerCase().slice(0, 254);
  const id = await readCartCookie();
  if (!id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const { error } = await createServiceClient()
    .from('carts')
    .update({ email })
    .eq('id', id)
    .eq('status', 'open')
    .is('email', null);
  if (error) console.error('[cart email]', error.message);
}

// ---------------------------------------------------------------------------
// On-demand revalidation (kept for compatibility with /api/revalidate)
// ---------------------------------------------------------------------------

export async function revalidate(req: NextRequest): Promise<NextResponse> {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ status: 401 }, { status: 401 });
  }
  revalidateTag(TAGS.collections);
  revalidateTag(TAGS.products);
  return NextResponse.json({ status: 200, revalidated: true, now: Date.now() });
}
