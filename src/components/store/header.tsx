import type { StoreSettingsRow } from '@/lib/commerce/db';
import { toNumber } from '@/lib/commerce/pricing';
import type { Collection } from '@/lib/commerce/types';
import type { SiteContent } from '@/lib/content';
import { PRIMARY_NAV, SITE } from '@/lib/site';
import Image from 'next/image';
import Link from 'next/link';
import { CartDrawer } from './cart-drawer';
import { CurrencySelect, Money } from './currency';
import type { ReactNode } from 'react';
import { CloseIcon, MenuIcon, SearchIcon } from './icons';

export function announcementFor(settings: StoreSettingsRow): ReactNode {
  const threshold = toNumber(settings.free_shipping_threshold);
  return threshold > 0 ? (
    <>
      Free worldwide shipping on orders over <Money amount={threshold} currencyCode={settings.currency} />
    </>
  ) : (
    SITE.tagline
  );
}

/** The menu shown when nothing has been set in /admin → Online store → Menu. */
export function automaticNav(collections: Collection[]) {
  return [
    ...PRIMARY_NAV.slice(0, 2),
    ...collections.filter((c) => c.handle).slice(0, 5).map((c) => ({ title: c.title, path: c.path })),
    ...PRIMARY_NAV.slice(2)
  ];
}

export function Header({
  settings,
  collections,
  announcement,
  menu
}: {
  settings: StoreSettingsRow;
  collections: Collection[];
  announcement: SiteContent['announcement'];
  menu?: SiteContent['nav'];
}) {
  const announcementText = announcement.text || announcementFor(settings);
  const nav = menu?.items.length
    ? menu.items.map((i) => ({ title: i.label, path: i.link }))
    : automaticNav(collections);
  const storeName = settings.store_name || SITE.name;

  return (
    <header className="sticky top-0 z-30 bg-page">
      {announcement.enabled && (
        <p className="bg-black px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
          {announcement.link ? (
            <Link href={announcement.link} className="underline-offset-4 hover:underline">
              {announcementText}
            </Link>
          ) : (
            announcementText
          )}
        </p>
      )}

      <div className="border-b border-line">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3 lg:py-4">
          <div className="flex items-center gap-4">
            {/* Mobile menu: a native <details>, so it works before JavaScript loads. */}
            <details className="group lg:hidden">
              <summary className="flex cursor-pointer list-none items-center p-1 [&::-webkit-details-marker]:hidden" aria-label="Menu">
                <MenuIcon className="group-open:hidden" />
                <CloseIcon className="hidden group-open:block" />
              </summary>
              <nav
                aria-label="Mobile"
                className="absolute inset-x-0 top-full max-h-[75vh] overflow-y-auto border-b border-line bg-page px-4 py-4 shadow-lg"
              >
                <form action="/search" role="search" className="mb-3 flex border border-fg">
                  <input name="q" type="search" placeholder="Search perfumes" aria-label="Search perfumes" className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none" />
                  <button type="submit" aria-label="Search" className="bg-black px-3 text-white"><SearchIcon /></button>
                </form>
                <CurrencySelect className="mb-3 sm:hidden" />
                <ul>
                  {nav.map((item) => (
                    <li key={item.path} className="border-b border-line last:border-0">
                      <Link href={item.path} className="block py-3 text-xs font-semibold uppercase tracking-[0.14em]">
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </details>
            <div className="hidden gap-5 text-[11px] uppercase tracking-[0.14em] text-muted lg:flex">
              <Link href="/pages/contact" className="hover:text-fg">Help</Link>
              <Link href="/track" className="hover:text-fg">Track order</Link>
            </div>
          </div>

          <Link href="/" aria-label={`${storeName} home`} className="block">
            <Image src="/logo.png" alt={`${storeName} Perfumes`} width={900} height={380} priority className="h-11 w-auto lg:h-14" />
          </Link>

          <div className="flex items-center justify-end gap-2">
            <CurrencySelect className="hidden sm:flex" compact />
            <CartDrawer freeShippingOver={toNumber(settings.free_shipping_threshold)} />
          </div>
        </div>

        <div className="mx-auto hidden max-w-7xl items-center justify-center gap-7 px-4 pb-3 lg:flex">
          <nav aria-label="Main" className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2">
            {nav.map((item, i) => (
              <Link
                key={item.path}
                href={item.path}
                className={`text-[11px] font-bold uppercase tracking-[0.12em] hover:text-brand-600 ${i === 0 ? 'text-brand-600' : ''}`}
              >
                {item.title}
              </Link>
            ))}
          </nav>
          <form action="/search" role="search" className="flex items-center bg-black text-white">
            <SearchIcon className="ml-3" width={16} height={16} />
            <input
              name="q"
              type="search"
              placeholder="Search..."
              aria-label="Search perfumes"
              className="w-28 bg-transparent px-2 py-2.5 text-xs font-semibold placeholder:text-white focus:w-44 focus:outline-none"
            />
          </form>
        </div>
      </div>
    </header>
  );
}
