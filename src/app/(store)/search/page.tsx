import { ProductGrid } from '@/components/store/product-card';
import { SortSelect } from '@/components/store/sort-select';
import { getProducts } from '@/lib/commerce';
import { sorting } from '@/lib/constants';
import type { Metadata } from 'next';
import { Suspense } from 'react';

// Search results are endless near-duplicate URLs; keep them out of Google's index.
export const metadata: Metadata = { title: 'Search', robots: { index: false, follow: true } };

type Props = { searchParams: Promise<{ q?: string; sort?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = '', sort } = await searchParams;
  const query = q.slice(0, 80);
  const active = sorting.find((s) => s.slug === sort) ?? sorting[0]!;
  const products = await getProducts({ query, sortKey: active.sortKey, reverse: active.reverse }).catch(() => []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="heading-caps text-center text-2xl">{query ? `Results for “${query}”` : 'Search'}</h1>

      <form action="/search" role="search" className="mx-auto mt-6 flex max-w-xl border border-fg">
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search by perfume, brand or note"
          aria-label="Search perfumes"
          className="min-w-0 flex-1 px-4 py-3 text-sm outline-none"
        />
        <button type="submit" className="btn-solid">
          Search
        </button>
      </form>

      <div className="mt-8 flex items-center justify-between bg-surface px-4 py-2.5">
        <p className="text-[11px] uppercase tracking-[0.1em] text-muted">
          {products.length} product{products.length === 1 ? '' : 's'}
        </p>
        <Suspense>
          <SortSelect />
        </Suspense>
      </div>
      <div className="mt-8">
        <ProductGrid products={products} />
      </div>
    </div>
  );
}
