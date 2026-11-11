'use server';

import { action, requireStaff } from '@/lib/admin/auth';
import { slugify } from '@/lib/admin/format';
import { sanitizeHtml } from '@/lib/admin/sanitize';
import type { ProductInput } from '@/lib/admin/types';
import type { ProductStatus } from '@/lib/commerce/db';
import { TAGS } from '@/lib/constants';
import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath, revalidateTag } from 'next/cache';

const num = (v: string | number | null | undefined) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const optNum = (v: string | null | undefined) => (v === null || v === undefined || String(v).trim() === '' ? null : num(v));

const cleanList = (xs: string[] | undefined) => [...new Set((xs ?? []).map((x) => x.trim()).filter(Boolean))];

async function uniqueHandle(db: SupabaseClient, table: 'products' | 'collections', base: string, id?: string) {
  const root = slugify(base) || 'item';
  let candidate = root;
  for (let i = 2; i < 200; i++) {
    let q = db.from(table).select('id').eq('handle', candidate);
    if (id) q = q.neq('id', id);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

function refreshStorefront() {
  revalidateTag(TAGS.products);
  revalidateTag(TAGS.collections);
  revalidatePath('/', 'layout');
}

export async function saveProduct(input: ProductInput) {
  return action(async () => {
    const { supabase: db } = await requireStaff();

    const title = input.title.trim();
    if (!title) throw new Error('Title can’t be blank.');

    const options = input.options
      .map((o) => ({ name: o.name.trim(), values: [...new Set(o.values.map((v) => v.trim()).filter(Boolean))] }))
      .filter((o) => o.name && o.values.length)
      .slice(0, 3);

    const handle = await uniqueHandle(db, 'products', input.handle || title, input.id);

    const row = {
      title,
      handle,
      description_html: sanitizeHtml(input.description_html),
      status: input.status,
      product_type: input.product_type.trim() || null,
      vendor: input.vendor.trim() || null,
      tags: [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))],
      options,
      seo_title: input.seo_title.trim() || null,
      seo_description: input.seo_description.trim() || null,
      gender: input.gender || null,
      concentration: input.concentration.trim() || null,
      scent_family: input.scent_family.trim() || null,
      top_notes: cleanList(input.top_notes),
      heart_notes: cleanList(input.heart_notes),
      base_notes: cleanList(input.base_notes)
    };

    let productId = input.id;
    if (productId) {
      const { error } = await db.from('products').update(row).eq('id', productId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await db.from('products').insert(row).select('id').single();
      if (error) throw new Error(error.message);
      productId = data.id as string;
    }

    // --- Images: replace the set, keep ids that survived ----------------------
    const { data: existingImages } = await db.from('product_images').select('id').eq('product_id', productId);
    const keepImageIds = new Set(input.images.map((i) => i.id).filter(Boolean));
    const dropImages = (existingImages ?? []).map((i) => i.id as string).filter((id) => !keepImageIds.has(id));
    if (dropImages.length) await db.from('product_images').delete().in('id', dropImages);

    for (const [position, img] of input.images.entries()) {
      const imgRow = { product_id: productId, url: img.url, alt: img.alt, width: img.width, height: img.height, position };
      const { error } = img.id
        ? await db.from('product_images').update(imgRow).eq('id', img.id)
        : await db.from('product_images').insert(imgRow);
      if (error) throw new Error(error.message);
    }

    // --- Variants ------------------------------------------------------------
    const variants = options.length
      ? input.variants.filter((v) => v.option1)
      : [input.variants[0] ?? { option1: null, option2: null, option3: null, price: '0', compare_at_price: '', sku: '', barcode: '', inventory_quantity: 0, track_inventory: false, continue_selling: false }];

    const { data: existingVariants } = await db.from('product_variants').select('id').eq('product_id', productId);
    const keepVariantIds = new Set(variants.map((v) => v.id).filter(Boolean));
    const dropVariants = (existingVariants ?? []).map((v) => v.id as string).filter((id) => !keepVariantIds.has(id));
    if (dropVariants.length) await db.from('product_variants').delete().in('id', dropVariants);

    for (const [position, v] of variants.entries()) {
      const values = options.length ? [v.option1, v.option2, v.option3].slice(0, options.length) : [];
      const vRow = {
        product_id: productId,
        title: values.length ? values.filter(Boolean).join(' / ') : 'Default Title',
        option1: options.length > 0 ? v.option1 : null,
        option2: options.length > 1 ? v.option2 : null,
        option3: options.length > 2 ? v.option3 : null,
        price: num(v.price),
        compare_at_price: optNum(v.compare_at_price),
        sku: v.sku?.trim() || null,
        barcode: v.barcode?.replace(/[^0-9A-Za-z]/g, '') || null,
        inventory_quantity: Math.trunc(Number(v.inventory_quantity) || 0),
        track_inventory: !!v.track_inventory,
        continue_selling: !!v.continue_selling,
        position
      };
      const { error } = v.id
        ? await db.from('product_variants').update(vRow).eq('id', v.id)
        : await db.from('product_variants').insert(vRow);
      if (error) throw new Error(error.message);
    }

    // --- Collections ------------------------------------------------------------
    const { data: links } = await db.from('collection_products').select('collection_id').eq('product_id', productId);
    const current = new Set((links ?? []).map((l) => l.collection_id as string));
    const wanted = new Set(input.collection_ids);
    const remove = [...current].filter((c) => !wanted.has(c));
    const add = [...wanted].filter((c) => !current.has(c));
    if (remove.length) {
      await db.from('collection_products').delete().eq('product_id', productId).in('collection_id', remove);
    }
    for (const collectionId of add) {
      const { data: last } = await db
        .from('collection_products')
        .select('position')
        .eq('collection_id', collectionId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();
      await db
        .from('collection_products')
        .insert({ collection_id: collectionId, product_id: productId, position: (last?.position ?? -1) + 1 });
    }

    refreshStorefront();
    revalidatePath('/admin/products');
    return { id: productId, handle };
  });
}

export async function setProductsStatus(ids: string[], status: ProductStatus) {
  return action(async () => {
    const { supabase: db } = await requireStaff();
    const { error } = await db.from('products').update({ status }).in('id', ids);
    if (error) throw new Error(error.message);
    refreshStorefront();
    revalidatePath('/admin/products');
  });
}

export async function deleteProducts(ids: string[]) {
  return action(async () => {
    const { supabase: db } = await requireStaff();
    const { error } = await db.from('products').delete().in('id', ids);
    if (error) throw new Error(error.message);
    refreshStorefront();
    revalidatePath('/admin/products');
  });
}

export async function duplicateProduct(id: string) {
  return action(async () => {
    const { supabase: db } = await requireStaff();
    const { data: p, error } = await db
      .from('products')
      .select('*, product_images(*), product_variants(*), collection_products(collection_id)')
      .eq('id', id)
      .single();
    if (error || !p) throw new Error(error?.message ?? 'Product not found.');

    const handle = await uniqueHandle(db, 'products', `${p.handle}-copy`);
    const { data: created, error: insErr } = await db
      .from('products')
      .insert({
        title: `Copy of ${p.title}`,
        handle,
        description_html: p.description_html,
        status: 'draft',
        product_type: p.product_type,
        vendor: p.vendor,
        tags: p.tags,
        options: p.options,
        seo_title: p.seo_title,
        seo_description: p.seo_description,
        gender: p.gender,
        concentration: p.concentration,
        scent_family: p.scent_family,
        top_notes: p.top_notes ?? [],
        heart_notes: p.heart_notes ?? [],
        base_notes: p.base_notes ?? []
      })
      .select('id')
      .single();
    if (insErr) throw new Error(insErr.message);

    const newId = created.id as string;
    if (p.product_images?.length) {
      await db.from('product_images').insert(
        p.product_images.map((i: Record<string, unknown>) => ({
          product_id: newId, url: i.url, alt: i.alt, width: i.width, height: i.height, position: i.position
        }))
      );
    }
    if (p.product_variants?.length) {
      await db.from('product_variants').insert(
        p.product_variants.map((v: Record<string, unknown>) => ({
          product_id: newId,
          title: v.title, sku: null, price: v.price, compare_at_price: v.compare_at_price,
          option1: v.option1, option2: v.option2, option3: v.option3,
          inventory_quantity: 0, track_inventory: v.track_inventory, continue_selling: v.continue_selling,
          position: v.position
        }))
      );
    }
    revalidatePath('/admin/products');
    return { id: newId };
  });
}
