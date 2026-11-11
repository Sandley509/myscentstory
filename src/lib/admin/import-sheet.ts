/**
 * Product import: turns spreadsheet rows into products.
 *
 * Pure functions, used in the browser (to preview the file before anything is
 * saved) and again on the server (which never trusts what the browser sends).
 *
 * Format: one row per product; extra rows with the same Handle add sizes.
 * Column names are matched loosely, so a Shopify product export also works
 * (Vendor, Body (HTML), Variant Price, Option1 Value, Image Src...).
 */
import { slugify } from './format';

export type ImportVariant = {
  size: string | null;
  price: number;
  compareAtPrice: number | null;
  sku: string | null;
  barcode: string | null;
  inventory: number | null;
};

export type ImportProduct = {
  /** Spreadsheet row of the product's first line (for messages). */
  row: number;
  handle: string;
  title: string;
  brand: string | null;
  productType: string | null;
  gender: 'female' | 'male' | 'unisex' | null;
  concentration: string | null;
  scentFamily: string | null;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  description: string;
  seoTitle: string | null;
  seoDescription: string | null;
  tags: string[];
  collections: string[];
  status: 'active' | 'draft';
  imageFiles: string[];
  imageUrls: string[];
  variants: ImportVariant[];
};

export type ParseResult = { products: ImportProduct[]; errors: string[]; warnings: string[] };

type Field =
  | 'handle' | 'title' | 'brand' | 'productType' | 'gender' | 'concentration' | 'scentFamily' | 'size'
  | 'price' | 'compareAtPrice' | 'sku' | 'barcode' | 'inventory' | 'topNotes' | 'heartNotes' | 'baseNotes'
  | 'description' | 'seoTitle' | 'seoDescription' | 'tags' | 'collections' | 'status' | 'imageFiles' | 'imageUrls';

const ALIASES: Record<Field, string[]> = {
  handle: ['handle', 'url handle'],
  title: ['title', 'name', 'product name', 'product title'],
  brand: ['brand', 'vendor', 'house'],
  productType: ['product type', 'type', 'product category'],
  gender: ['gender', 'for'],
  concentration: ['concentration'],
  scentFamily: ['scent family', 'family', 'olfactory family'],
  size: ['size', 'volume', 'option1 value', 'variant'],
  price: ['price', 'variant price', 'base price'],
  compareAtPrice: ['compare-at price', 'compare at price', 'variant compare at price', 'original price'],
  sku: ['sku', 'variant sku'],
  barcode: ['barcode', 'variant barcode', 'gtin', 'upc', 'ean'],
  inventory: ['inventory', 'stock', 'quantity', 'variant inventory qty', 'inventory quantity'],
  topNotes: ['top notes', 'top'],
  heartNotes: ['heart notes', 'middle notes', 'heart'],
  baseNotes: ['base notes', 'base'],
  description: ['description', 'body (html)', 'body html', 'body'],
  seoTitle: ['seo title'],
  seoDescription: ['seo description', 'meta description'],
  tags: ['tags'],
  collections: ['collections', 'collection'],
  status: ['status', 'published'],
  imageFiles: ['image files', 'image file', 'images', 'photo', 'photos', 'image'],
  imageUrls: ['image urls', 'image url', 'image src']
};

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Cell → trimmed text ('' for empty). Numbers keep their digits (barcodes!). */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, ' ').trim();
}

const list = (s: string, sep = /[,;\n]/) =>
  [...new Set(s.split(sep).map((x) => x.trim()).filter(Boolean))];

/** "$150", "150,00", "1 299.90" → number; null when empty or not a number. */
export function parseMoney(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  let s = cellText(v).replace(/[^\d.,-]/g, '');
  if (!s) return null;
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function parseGender(s: string): ImportProduct['gender'] {
  const v = s.toLowerCase();
  if (!v) return null;
  if (/(^|\b)(unisex|mixte|shared)/.test(v)) return 'unisex';
  if (/(female|women|woman|her|femme|ladies|lady)/.test(v)) return 'female';
  if (/(male|men|man|him|homme)/.test(v)) return 'male';
  return null;
}

/** Normalise a photo file name so "Photo 1.JPG" in the sheet matches "photo 1.jpg" on disk. */
export const fileKey = (name: string) =>
  name.split(/[\\/]/).pop()!.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');

export const MAX_IMPORT_ROWS = 2000;

export function parseSheet(rows: unknown[][]): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const headerIndex = rows.findIndex((r) => r.some((c) => cellText(c)));
  if (headerIndex < 0) return { products: [], errors: ['The sheet is empty.'], warnings };

  const header = rows[headerIndex]!.map(norm);
  const col = {} as Record<Field, number>;
  for (const [field, names] of Object.entries(ALIASES) as [Field, string[]][]) {
    col[field] = header.findIndex((h) => names.includes(h));
  }
  if (col.title < 0) errors.push('No “Title” column found in the first row.');
  if (col.price < 0) errors.push('No “Price” column found in the first row.');
  if (errors.length) return { products: [], errors, warnings };

  const body = rows.slice(headerIndex + 1);
  if (body.length > MAX_IMPORT_ROWS) {
    return { products: [], errors: [`The sheet has ${body.length} rows; import at most ${MAX_IMPORT_ROWS} at a time.`], warnings };
  }

  const byHandle = new Map<string, ImportProduct>();
  body.forEach((r, i) => {
    const rowNo = headerIndex + i + 2;
    const get = (f: Field) => (col[f] >= 0 ? cellText(r[col[f]]) : '');
    if (!r.some((c) => cellText(c))) return;

    const title = get('title');
    const handle = slugify(get('handle') || [get('brand'), title].filter(Boolean).join(' '));
    if (!handle) {
      errors.push(`Row ${rowNo}: needs a Title (or a Handle).`);
      return;
    }

    const price = parseMoney(col.price >= 0 ? r[col.price] : null);
    const compareAt = parseMoney(col.compareAtPrice >= 0 ? r[col.compareAtPrice] : null);
    const invText = get('inventory');
    const variant: ImportVariant = {
      size: get('size') || null,
      price: price ?? 0,
      compareAtPrice: compareAt && price && compareAt > price ? compareAt : null,
      sku: get('sku') || null,
      barcode: get('barcode').replace(/[^0-9A-Za-z]/g, '') || null,
      inventory: invText === '' ? null : Math.max(0, Math.trunc(Number(invText)) || 0)
    };
    if (variant.size === 'Default Title') variant.size = null;
    if (!(price && price > 0)) errors.push(`Row ${rowNo}: Price must be a number above 0.`);
    if (compareAt && price && compareAt <= price) warnings.push(`Row ${rowNo}: Compare-at price ignored (it must be higher than Price).`);

    const existing = byHandle.get(handle);
    if (existing) {
      // Another size of a product already started above.
      if (existing.variants.some((v) => (v.size ?? '') === (variant.size ?? ''))) {
        errors.push(`Row ${rowNo}: “${existing.title}” already has a row${variant.size ? ` for size ${variant.size}` : ''}.`);
        return;
      }
      if (!variant.size || existing.variants.some((v) => !v.size)) {
        errors.push(`Row ${rowNo}: every row of a product with several sizes needs a Size.`);
        return;
      }
      existing.variants.push(variant);
      existing.imageFiles.push(...list(get('imageFiles'), /[;\n|]/).filter((f) => !existing.imageFiles.includes(f)));
      existing.imageUrls.push(...list(get('imageUrls'), /[;\s|]/).filter((u) => !existing.imageUrls.includes(u)));
      return;
    }

    if (!title) {
      errors.push(`Row ${rowNo}: needs a Title.`);
      return;
    }

    const statusText = get('status').toLowerCase();
    const description = get('description');
    const imageUrls = list(get('imageUrls'), /[;\s|]/).filter((u) => {
      const ok = /^https:\/\//i.test(u);
      if (!ok) warnings.push(`Row ${rowNo}: skipped image link “${u.slice(0, 60)}” (must start with https://).`);
      return ok;
    });

    byHandle.set(handle, {
      row: rowNo,
      handle,
      title: title.slice(0, 255),
      brand: get('brand') || null,
      productType: get('productType') || null,
      gender: parseGender(get('gender')),
      concentration: get('concentration') || null,
      scentFamily: get('scentFamily') || null,
      topNotes: list(get('topNotes')),
      heartNotes: list(get('heartNotes')),
      baseNotes: list(get('baseNotes')),
      description,
      seoTitle: get('seoTitle').slice(0, 70) || null,
      seoDescription: get('seoDescription').slice(0, 160) || null,
      tags: list(get('tags')),
      collections: list(get('collections')),
      status: statusText === 'draft' || statusText === 'false' || statusText === 'archived' ? 'draft' : 'active',
      imageFiles: list(get('imageFiles'), /[;\n|]/),
      imageUrls,
      variants: [variant]
    });
  });

  const products = [...byHandle.values()];
  for (const p of products) {
    if (p.variants.length > 1 && p.variants.some((v) => !v.size)) {
      errors.push(`Row ${p.row}: “${p.title}” has several rows, so every row needs a Size.`);
    }
    if (p.variants.length > 100) errors.push(`Row ${p.row}: “${p.title}” has more than 100 sizes.`);
  }
  if (!products.length && !errors.length) errors.push('No products found under the header row.');
  return { products, errors, warnings };
}

/** Plain text from the sheet → safe paragraphs. HTML (e.g. a Shopify export) is passed through as-is for sanitising. */
export function descriptionToHtml(text: string): string {
  if (/<\/?(p|br|ul|li|strong|em|h[1-6])\b/i.test(text)) return text;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}
