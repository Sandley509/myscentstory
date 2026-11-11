import { BottleStage, STAGE_BG } from '@/components/store/art';
import { Breadcrumbs } from '@/components/store/breadcrumbs';
import { JsonLd } from '@/components/store/json-ld';
import { ProductGrid } from '@/components/store/product-card';
import { SortSelect } from '@/components/store/sort-select';
import { getCollection, getCollectionProducts, getCollections, getProducts } from '@/lib/commerce';
import type { Collection } from '@/lib/commerce/types';
import { sorting } from '@/lib/constants';
import { collectionJsonLd } from '@/lib/seo';
import { SITE } from '@/lib/site';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ sort?: string }> };

/** `/collections/all` is every active product, like Shopify's built-in "all" collection. */
const ALL: Collection = {
  handle: 'all',
  title: 'All perfumes',
  description: 'Every perfume, cologne and gift set in the shop, for her and for him.',
  image: null,
  seo: {
    title: 'All Perfumes & Colognes',
    description: 'Shop every perfume, cologne and gift set at MyScentStory. Eau de parfum and eau de toilette for women and men.'
  },
  path: '/collections/all',
  updatedAt: ''
};

const load = (handle: string) => (handle === 'all' ? Promise.resolve(ALL) : getCollection(handle).catch(() => undefined));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const collection = await load(handle);
  if (!collection) return { title: 'Not found' };
  const description = collection.seo.description || collection.description || undefined;
  return {
    title: collection.seo.title,
    description,
    // Sorted views are the same page: one canonical URL keeps ranking signals together.
    alternates: { canonical: collection.path },
    openGraph: {
      title: collection.seo.title,
      description,
      type: 'website',
      siteName: SITE.name,
      locale: SITE.locale,
      url: collection.path,
      images: [{ url: collection.image?.url ?? '/og.png' }]
    }
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ handle }, { sort }] = await Promise.all([params, searchParams]);
  const collection = await load(handle);
  if (!collection) notFound();

  const active = sorting.find((s) => s.slug === sort) ?? sorting[0]!;
  const [products, collections] = await Promise.all([
    (handle === 'all'
      ? getProducts({ sortKey: active.sortKey, reverse: active.reverse })
      : getCollectionProducts({
          collection: handle,
          sortKey: active.slug ? active.sortKey : undefined,
          reverse: active.reverse
        })
    ).catch(() => []),
    getCollections().catch(() => [])
  ]);

  return (
    <>
      <JsonLd data={collectionJsonLd(collection, products)} />
      <div className="mx-auto max-w-7xl px-4 pt-6">
        <Breadcrumbs trail={[{ name: collection.title, path: collection.path }]} />

        {/* Banner. The photo comes from /admin → Collections → this collection →
            Banner photo; without one the store draws its bottle artwork. */}
        {collection.image ? (
          <div className={`${STAGE_BG} relative mt-5 flex h-44 items-center justify-center overflow-hidden text-white sm:h-56 lg:h-64`}>
            <Image
              src={collection.image.url}
              alt=""
              fill
              priority
              sizes="(min-width: 1280px) 1280px, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/35" />
            <h1 className="heading-caps relative px-6 text-center text-3xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] lg:text-4xl">
              {collection.title}
            </h1>
          </div>
        ) : (
          <div className={`${STAGE_BG} mt-5 grid items-center overflow-hidden text-white sm:grid-cols-2`}>
            <BottleStage className="hidden h-44 sm:block" />
            <h1 className="heading-caps px-6 py-12 text-center text-3xl sm:py-0 lg:text-4xl">{collection.title}</h1>
          </div>
        )}

        <nav aria-label="Collections" className="mt-8 flex flex-wrap justify-center gap-2">
          {[ALL, ...collections.filter((c) => c.handle)].map((c) => (
            <Link
              key={c.handle}
              href={c.path}
              aria-current={c.handle === handle ? 'page' : undefined}
              className={`rounded-full border px-5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] ${
                c.handle === handle ? 'border-fg bg-fg text-white' : 'border-line hover:border-fg'
              }`}
            >
              {c.handle === 'all' ? 'All' : c.title}
            </Link>
          ))}
        </nav>

        <div className="mt-8 flex items-center justify-between bg-surface px-4 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.1em] text-muted">
            {products.length} product{products.length === 1 ? '' : 's'}
          </p>
          <Suspense>
            <SortSelect />
          </Suspense>
        </div>

        <div className="mt-8">
          <ProductGrid products={products} priorityCount={4} />
        </div>

        {collection.description && (
          <p className="mx-auto mt-16 max-w-2xl text-center text-sm leading-relaxed text-muted">{collection.description}</p>
        )}
      </div>
    </>
  );
}
