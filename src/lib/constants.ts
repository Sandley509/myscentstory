export type SortFilterItem = {
  title: string;
  slug: string | null;
  sortKey: 'RELEVANCE' | 'BEST_SELLING' | 'CREATED_AT' | 'PRICE';
  reverse: boolean;
};

export const defaultSort: SortFilterItem = {
  title: 'Relevance',
  slug: null,
  sortKey: 'RELEVANCE',
  reverse: false
};

export const sorting: SortFilterItem[] = [
  defaultSort,
  { title: 'Best selling', slug: 'trending-desc', sortKey: 'BEST_SELLING', reverse: false },
  { title: 'Newest', slug: 'latest-desc', sortKey: 'CREATED_AT', reverse: true },
  { title: 'Price: low to high', slug: 'price-asc', sortKey: 'PRICE', reverse: false },
  { title: 'Price: high to low', slug: 'price-desc', sortKey: 'PRICE', reverse: true }
];

/** Cache tags used by on-demand revalidation. */
export const TAGS = {
  collections: 'collections',
  products: 'products',
  cart: 'cart'
};

/** Products carrying this tag never show up in listings. */
export const HIDDEN_PRODUCT_TAG = 'hidden';

export const DEFAULT_OPTION = 'Default Title';

/**
 * Tag helpers — use product tags to switch on per-product behaviour in your
 * storefront (e.g. `made-to-order`, `local-delivery-only`) without a schema
 * change. Staff type tags freely, so compare through `normalizeTag`.
 */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

export function hasProductTag(tags: string[] | undefined, tag: string): boolean {
  const needle = normalizeTag(tag);
  return (tags ?? []).some((t) => normalizeTag(t) === needle);
}

export function hasAnyProductTag(tags: string[] | undefined, candidates: readonly string[]): boolean {
  const normalized = new Set((tags ?? []).map(normalizeTag));
  return candidates.some((c) => normalized.has(normalizeTag(c)));
}
