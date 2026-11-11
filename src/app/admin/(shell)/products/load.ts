import 'server-only';

import type { ProductInput } from '@/lib/admin/types';
import type { ProductWithRelations } from '@/lib/commerce/db';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function loadProductFormData(db: SupabaseClient) {
  const [{ data: collections }, { data: meta }, { data: settings }] = await Promise.all([
    db.from('collections').select('id, title').order('title'),
    db.from('products').select('product_type, vendor, tags').limit(1000),
    db.from('store_settings').select('currency').eq('id', 1).maybeSingle()
  ]);
  const uniq = (xs: (string | null | undefined)[]) =>
    [...new Set(xs.filter((x): x is string => !!x && !!x.trim()))].sort((a, b) => a.localeCompare(b));
  return {
    collections: (collections ?? []) as { id: string; title: string }[],
    suggestions: {
      types: uniq((meta ?? []).map((m) => m.product_type)),
      vendors: uniq((meta ?? []).map((m) => m.vendor)),
      tags: uniq((meta ?? []).flatMap((m) => m.tags ?? []))
    },
    currency: (settings?.currency as string) ?? 'CAD'
  };
}

export function toProductInput(p: ProductWithRelations, collectionIds: string[]): ProductInput {
  const s = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : Number(v).toFixed(2));
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    description_html: p.description_html ?? '',
    status: p.status,
    product_type: p.product_type ?? '',
    vendor: p.vendor ?? '',
    tags: p.tags ?? [],
    seo_title: p.seo_title ?? '',
    seo_description: p.seo_description ?? '',
    gender: p.gender ?? '',
    concentration: p.concentration ?? '',
    scent_family: p.scent_family ?? '',
    top_notes: p.top_notes ?? [],
    heart_notes: p.heart_notes ?? [],
    base_notes: p.base_notes ?? [],
    options: (p.options ?? []).map((o) => ({ name: o.name, values: [...o.values] })),
    variants: [...(p.product_variants ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((v) => ({
        id: v.id,
        option1: v.option1,
        option2: v.option2,
        option3: v.option3,
        price: s(v.price),
        compare_at_price: s(v.compare_at_price),
        sku: v.sku ?? '',
        barcode: v.barcode ?? '',
        inventory_quantity: v.inventory_quantity,
        track_inventory: v.track_inventory,
        continue_selling: v.continue_selling
      })),
    images: [...(p.product_images ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ id: i.id, url: i.url, alt: i.alt, width: i.width, height: i.height })),
    collection_ids: collectionIds
  };
}
