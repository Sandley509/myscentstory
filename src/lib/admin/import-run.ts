import 'server-only';

import { slugify } from './format';
import { descriptionToHtml, type ImportProduct } from './import-sheet';
import { sanitizeHtml } from './sanitize';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/supabase/env';

/** https links, plus photos in this project's own storage (http when running Supabase locally). */
const allowedImage = (url: string) =>
  /^https:\/\//i.test(url) || (!!SUPABASE_URL && url.startsWith(`${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/`));

export type ImportItem = ImportProduct & {
  /** Public URLs of the photos already uploaded by the browser, in display order. */
  uploadedImages: { url: string; width: number | null; height: number | null }[];
};

export type ImportOutcome = {
  handle: string;
  title: string;
  result: 'created' | 'updated' | 'failed';
  message?: string;
  /** Photos saved on the product by this import. */
  imagesAttached: number;
  /** Categories the product was put in (titles as written in the sheet). */
  collections: string[];
};

export const MAX_BATCH = 25;
const cleanList = (xs: unknown, max = 40) =>
  Array.isArray(xs) ? [...new Set(xs.map((x) => String(x).trim().slice(0, 80)).filter(Boolean))].slice(0, max) : [];
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

/** Saves a batch of imported products with the given (staff) client. */
export async function runImport(db: SupabaseClient, items: ImportItem[]): Promise<ImportOutcome[]> {
  if (!Array.isArray(items) || !items.length) throw new Error('Nothing to import.');
  if (items.length > MAX_BATCH) throw new Error(`Send at most ${MAX_BATCH} products at a time.`);

  const collectionIds = new Map<string, string>();
  const collectionFor = async (name: string) => {
    const handle = slugify(name);
    if (!handle) return null;
    if (collectionIds.has(handle)) return collectionIds.get(handle)!;
    const { data: found } = await db.from('collections').select('id').eq('handle', handle).maybeSingle();
    let id = found?.id as string | undefined;
    if (!id) {
      const { data: created, error } = await db
        .from('collections')
        .insert({ handle, title: name.trim().slice(0, 120), published: true })
        .select('id')
        .single();
      if (error) throw new Error(`Collection “${name}”: ${error.message}`);
      id = created.id as string;
    }
    collectionIds.set(handle, id);
    return id;
  };

  const outcomes: ImportOutcome[] = [];

  for (const item of items) {
    const handle = slugify(String(item.handle ?? ''));
    const title = text(item.title, 255);
    let imagesAttached = 0;
    const assigned: string[] = [];
    try {
      if (!handle || !title) throw new Error('Missing title.');
      const variants = (Array.isArray(item.variants) ? item.variants : []).slice(0, 100);
      if (!variants.length || variants.some((v) => !money(v.price))) throw new Error('Every size needs a price above 0.');
      const sized = variants.some((v) => text(v.size, 60));
      if (sized && variants.some((v) => !text(v.size, 60))) throw new Error('Every row of a multi-size product needs a Size.');

      const gender = ['female', 'male', 'unisex'].includes(String(item.gender)) ? item.gender : null;
      const row = {
        handle,
        title,
        description_html: sanitizeHtml(descriptionToHtml(String(item.description ?? '').slice(0, 20_000))),
        status: item.status === 'draft' ? 'draft' : 'active',
        product_type: text(item.productType, 80),
        vendor: text(item.brand, 120),
        tags: cleanList(item.tags),
        options: sized ? [{ name: 'Size', values: variants.map((v) => String(v.size).trim().slice(0, 60)) }] : [],
        seo_title: text(item.seoTitle, 70),
        seo_description: text(item.seoDescription, 160),
        gender,
        concentration: text(item.concentration, 80),
        scent_family: text(item.scentFamily, 60),
        top_notes: cleanList(item.topNotes, 20),
        heart_notes: cleanList(item.heartNotes, 20),
        base_notes: cleanList(item.baseNotes, 20)
      };

      const { data: existing } = await db.from('products').select('id').eq('handle', handle).maybeSingle();
      let productId = existing?.id as string | undefined;
      if (productId) {
        const { data: changed, error } = await db.from('products').update(row).eq('id', productId).select('id');
        if (error) throw new Error(error.message);
        // Row-level security silently skips rows this account may not change.
        if (!changed?.length) throw new Error('Your account isn’t allowed to change products.');
      } else {
        const { data, error } = await db.from('products').insert(row).select('id').single();
        if (error) throw new Error(error.message);
        productId = data.id as string;
      }

      // Variants: match existing ones by size so stock and order history stay attached.
      const { data: current } = await db.from('product_variants').select('id, option1').eq('product_id', productId);
      const bySize = new Map((current ?? []).map((v) => [String(v.option1 ?? ''), v.id as string]));
      const keep = new Set<string>();
      for (const [position, v] of variants.entries()) {
        const size = sized ? String(v.size).trim().slice(0, 60) : null;
        const vRow = {
          product_id: productId,
          title: size ?? 'Default Title',
          option1: size,
          price: money(v.price)!,
          compare_at_price: money(v.compareAtPrice) && money(v.compareAtPrice)! > money(v.price)! ? money(v.compareAtPrice) : null,
          sku: text(v.sku, 80),
          barcode: text(String(v.barcode ?? '').replace(/[^0-9A-Za-z]/g, ''), 40),
          track_inventory: v.inventory !== null && v.inventory !== undefined,
          inventory_quantity: Math.max(0, Math.trunc(Number(v.inventory) || 0)),
          position
        };
        const id = bySize.get(size ?? '') ?? (!sized && current?.length === 1 ? (current[0]!.id as string) : undefined);
        if (id) {
          keep.add(id);
          const { error } = await db.from('product_variants').update(vRow).eq('id', id);
          if (error) throw new Error(error.message);
        } else {
          const { data, error } = await db.from('product_variants').insert(vRow).select('id').single();
          if (error) throw new Error(error.message);
          keep.add(data.id as string);
        }
      }
      const drop = (current ?? []).map((v) => v.id as string).filter((id) => !keep.has(id));
      if (drop.length) await db.from('product_variants').delete().in('id', drop);

      // Photos. The sheet's file names are the contract: if the browser didn't
      // upload one of them, stop rather than save a product missing a photo.
      const wanted = cleanList(item.imageFiles, 20).length;
      const uploaded = (Array.isArray(item.uploadedImages) ? item.uploadedImages : [])
        .filter((i) => typeof i?.url === 'string' && allowedImage(i.url))
        .slice(0, 20);
      if (wanted && uploaded.length < wanted) {
        throw new Error(`Only ${uploaded.length} of ${wanted} photos were uploaded. Select every photo named in the sheet and import again.`);
      }
      const urls = [
        ...uploaded,
        ...cleanList(item.imageUrls, 20)
          .filter((u) => /^https:\/\//i.test(u))
          .map((url) => ({ url, width: null, height: null }))
      ];
      // Supplied photos replace the product's set, so photo 1 is the main image
      // and importing the same sheet twice never piles up duplicates.
      if (urls.length) {
        const { error: clear } = await db.from('product_images').delete().eq('product_id', productId);
        if (clear) throw new Error(clear.message);
        const { data: saved, error } = await db
          .from('product_images')
          .insert(
            urls.map((img, position) => ({
              product_id: productId,
              url: img.url,
              alt: [row.vendor, title].filter(Boolean).join(' '),
              width: img.width,
              height: img.height,
              position
            }))
          )
          .select('id');
        if (error) throw new Error(error.message);
        if (!saved?.length) throw new Error('Your account isn’t allowed to add product photos.');
        imagesAttached = saved.length;
      }

      for (const name of cleanList(item.collections, 10)) {
        const collectionId = await collectionFor(name);
        if (!collectionId) continue;
        assigned.push(name);
        const { data: linked } = await db
          .from('collection_products')
          .select('product_id')
          .eq('collection_id', collectionId)
          .eq('product_id', productId)
          .maybeSingle();
        if (!linked) {
          const { data: last } = await db
            .from('collection_products')
            .select('position')
            .eq('collection_id', collectionId)
            .order('position', { ascending: false })
            .limit(1)
            .maybeSingle();
          const { data: link, error } = await db
            .from('collection_products')
            .insert({ collection_id: collectionId, product_id: productId, position: (last?.position ?? -1) + 1 })
            .select('product_id');
          if (error) throw new Error(`Category “${name}”: ${error.message}`);
          // Row-level security returns no rows instead of an error.
          if (!link?.length) throw new Error(`Your account isn’t allowed to put products in the “${name}” category.`);
        }
      }

      outcomes.push({ handle, title, result: existing ? 'updated' : 'created', imagesAttached, collections: assigned });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error.';
      outcomes.push({
        handle,
        title: title ?? handle,
        result: 'failed',
        imagesAttached,
        collections: assigned,
        message: /column .*(gender|concentration|barcode|notes)/i.test(message)
          ? 'Run supabase/migrations/0002_perfume_merchant.sql in Supabase first.'
          : message
      });
    }
  }

  return outcomes;
}
