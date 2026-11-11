import { BottleStage, STAGE_BG } from '@/components/store/art';
import { HomeTabs } from '@/components/store/home-tabs';
import { ArrowIcon } from '@/components/store/icons';
import { getCollectionProducts, getCollections, getProducts, getSiteContent } from '@/lib/commerce';
import type { Collection } from '@/lib/commerce/types';
import type { CategoryTileContent } from '@/lib/content';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

// Rebuilt at most every 5 minutes, and immediately when a product is saved in /admin.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getSiteContent();
  return {
    alternates: { canonical: '/' },
    // Set in /admin → Online store → Search engine listing; empty = site defaults.
    ...(seo.homeTitle ? { title: { absolute: seo.homeTitle } } : {}),
    ...(seo.homeDescription ? { description: seo.homeDescription } : {})
  };
}

/** Products per tab in “Currently hot & loved”: two rows of four on desktop. */
const HOME_PRODUCTS = 8;

const TILE_ART = ['/art/bottle-3.svg', '/art/bottle-4.svg', '/art/bottle-2.svg', '/art/bottle-1.svg'];
const TILE_BG = [
  'bg-[linear-gradient(160deg,#6d0f55,#2a0420)]',
  'bg-[linear-gradient(160deg,#1c2f4f,#070d1a)]',
  'bg-[linear-gradient(160deg,#7a5a1e,#221705)]',
  'bg-[linear-gradient(160deg,#3a3a3a,#0a0a0a)]'
];

type Tile = { key: string; href: string; title: string; image?: string };

function CategoryTile({ tile, index, large = false }: { tile: Tile; index: number; large?: boolean }) {
  return (
    <Link
      href={tile.href}
      className={`group relative block overflow-hidden text-white ${large ? 'aspect-square lg:aspect-auto lg:h-full' : 'aspect-[4/3]'} ${TILE_BG[index % TILE_BG.length]}`}
    >
      {tile.image ? (
        <Image
          src={tile.image}
          alt=""
          fill
          sizes={large ? '(min-width: 1024px) 50vw, 100vw' : '(min-width: 1024px) 25vw, 100vw'}
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <Image
          src={TILE_ART[index % TILE_ART.length]!}
          alt=""
          width={600}
          height={600}
          className="absolute bottom-0 right-[6%] h-[82%] w-auto drop-shadow-[0_18px_30px_rgba(0,0,0,0.5)] transition-transform duration-700 group-hover:scale-105"
        />
      )}
      {tile.image && <span className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />}
      <span className="absolute left-4 top-4 flex items-center gap-2 text-sm font-semibold tracking-wide">
        {tile.title} <ArrowIcon width={16} height={16} />
      </span>
    </Link>
  );
}

/** Tiles chosen in /admin → Online store, or the first four collections when none are set. */
function buildTiles(shelves: Collection[], chosen: CategoryTileContent[]): Tile[] {
  if (!chosen.length) {
    return shelves.slice(0, 4).map((c) => ({ key: c.handle, href: c.path, title: c.title, image: c.image?.url }));
  }
  return chosen.flatMap((t, i): Tile[] => {
    if (t.collection === 'all') {
      return [{ key: `all-${i}`, href: '/collections/all', title: t.label || 'All perfumes', image: t.imageUrl || undefined }];
    }
    const c = shelves.find((s) => s.handle === t.collection);
    // A deleted or unpublished collection would lead to a 404, so its tile is skipped.
    if (!c) return [];
    return [{ key: `${c.handle}-${i}`, href: c.path, title: t.label || c.title, image: t.imageUrl || c.image?.url }];
  });
}

export default async function HomePage() {
  const [content, bestSellers, newest, collections] = await Promise.all([
    getSiteContent(),
    getProducts({ sortKey: 'BEST_SELLING' }).catch(() => []),
    getProducts({ sortKey: 'CREATED_AT', reverse: true }).catch(() => []),
    getCollections().catch(() => [])
  ]);

  const shelves = collections.filter((c) => c.handle);
  const giftCollection = shelves.find((c) => /gift/i.test(c.handle));
  const giftSets = giftCollection
    ? await getCollectionProducts({ collection: giftCollection.handle }).catch(() => [])
    : [];

  const tabs = [
    { label: 'Best sellers', href: '/collections/all?sort=trending-desc', products: bestSellers.slice(0, HOME_PRODUCTS) },
    { label: 'New', href: '/collections/all?sort=latest-desc', products: newest.slice(0, HOME_PRODUCTS) },
    ...(giftCollection && giftSets.length
      ? [{ label: giftCollection.title, href: giftCollection.path, products: giftSets.slice(0, HOME_PRODUCTS) }]
      : [])
  ].filter((t) => t.products.length);

  const families = [...new Set(bestSellers.map((p) => p.scentFamily).filter((f): f is string => !!f))].slice(0, 8);
  const tiles = buildTiles(shelves, content.categories.tiles);
  const { hero, promo, families: familySection } = content;

  // A banner button that points at a collection which was later deleted or
  // unpublished would 404; send it to the full catalogue instead.
  const live = new Set(shelves.map((c) => c.path));
  const safeLink = (link: string) =>
    link.startsWith('/collections/') && !link.startsWith('/collections/all') && !live.has(link.split('?')[0]!)
      ? '/collections/all'
      : link;

  return (
    <>
      {/* Hero */}
      <section className={`${STAGE_BG} relative overflow-hidden text-white`}>
        {hero.imageUrl && (
          <>
            {/* Desktop: the photo fills the banner, bottles left, text over the dark right side. */}
            <Image src={hero.imageUrl} alt="" fill priority sizes="100vw" className="hidden object-cover object-left lg:block" />
            <div className="absolute inset-0 hidden bg-gradient-to-l from-black/45 via-transparent to-transparent lg:block" />
          </>
        )}
        <div className="relative mx-auto grid max-w-7xl items-center lg:grid-cols-[1.1fr_1fr]">
          {hero.imageUrl ? (
            // Phone: text first, then the left (subject) side of the photo underneath.
            <div className="relative order-2 aspect-[16/9] lg:order-1 lg:aspect-auto lg:h-[30rem]">
              <Image src={hero.imageUrl} alt="" fill priority sizes="100vw" className="object-cover object-left lg:hidden" />
            </div>
          ) : (
            <BottleStage className="order-2 h-64 lg:order-1 lg:h-[30rem]" />
          )}
          <div className="order-1 px-6 pb-8 pt-12 text-center lg:order-2 lg:py-16 lg:pl-10">
            {hero.eyebrow && <p className="eyebrow text-accent">{hero.eyebrow}</p>}
            <h1 className="heading-caps mt-4 text-4xl leading-[1.05] lg:text-6xl">{hero.title}</h1>
            {hero.text && <p className="mx-auto mt-5 max-w-md text-base text-neutral-200">{hero.text}</p>}
            {hero.buttonLabel && (
              <Link href={safeLink(hero.buttonLink)} className="btn-light mt-8">
                {hero.buttonLabel}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Promo band */}
      {promo.enabled && promo.title && (
        <section className="mt-3 bg-brand-600 text-white">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-6 py-10 text-center md:flex-row md:justify-between md:text-left">
            <div>
              <h2 className="heading-caps text-2xl lg:text-3xl">{promo.title}</h2>
              {promo.text && <p className="mt-2 text-sm text-brand-100">{promo.text}</p>}
            </div>
            {promo.buttonLabel && (
              <Link href={safeLink(promo.buttonLink)} className="btn-light shrink-0">
                {promo.buttonLabel}
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Category chips */}
      {shelves.length > 0 && (
        <nav aria-label="Shop by category" className="mx-auto mt-8 flex max-w-7xl flex-wrap justify-center gap-2 px-4">
          {shelves.map((c) => (
            <Link
              key={c.handle}
              href={c.path}
              className="rounded-full border border-line px-5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] hover:border-fg"
            >
              {c.title}
            </Link>
          ))}
        </nav>
      )}

      {/* Product tabs */}
      {tabs.length > 0 && (
        <section aria-labelledby="loved-heading" className="mx-auto mt-14 max-w-7xl px-4">
          <h2 id="loved-heading" className="heading-caps mb-6 text-center text-2xl">
            {content.featured.title}
          </h2>
          <HomeTabs tabs={tabs} />
        </section>
      )}

      {/* Scent families */}
      {familySection.enabled && families.length > 0 && (
        <section className="mx-auto mt-20 grid max-w-7xl items-center gap-8 px-4 lg:grid-cols-2">
          <div className={`${STAGE_BG} relative aspect-[4/3] overflow-hidden lg:aspect-square`}>
            {familySection.imageUrl ? (
              <Image src={familySection.imageUrl} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            ) : (
              <div className="absolute inset-x-[8%] bottom-0 top-[18%]">
                <BottleStage className="h-full" count={3} />
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="heading-caps text-2xl">{familySection.title}</h2>
            {familySection.text && <p className="mx-auto mt-3 max-w-sm text-sm text-muted">{familySection.text}</p>}
            <ul className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2">
              {families.map((f) => (
                <li key={f}>
                  <Link
                    href={`/search?q=${encodeURIComponent(f)}`}
                    className="block border border-fg px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] hover:bg-fg hover:text-white"
                  >
                    {f}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Category tiles */}
      {tiles.length > 0 && (
        <section aria-labelledby="category-heading" className="mt-20">
          <h2 id="category-heading" className="heading-caps mb-6 text-center text-2xl">
            {content.categories.title}
          </h2>
          <div className="grid gap-1 lg:grid-cols-2">
            <CategoryTile tile={tiles[0]!} index={0} large />
            {tiles.length > 1 && (
              <div className="grid gap-1 sm:grid-cols-2">
                {tiles.slice(1).map((t, i) => (
                  <div key={t.key} className={i === 2 || tiles.length === 2 ? 'sm:col-span-2' : ''}>
                    <CategoryTile tile={t} index={i + 1} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
