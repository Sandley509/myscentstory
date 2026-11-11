'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CustomersIcon,
  DiscountsIcon,
  ExternalIcon,
  AnalyticsIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  OrdersIcon,
  ProductsIcon,
  SearchIcon,
  SettingsIcon,
  StoreIcon,
  XIcon
} from './icons';

type NavItem = {
  label: string;
  href: string;
  icon: (p: { width?: number; height?: number }) => ReactNode;
  exact?: boolean;
  children?: { label: string; href: string }[];
  badge?: number;
};

export function AdminShell({
  storeName,
  staffName,
  staffEmail,
  ordersBadge,
  signOut,
  children
}: {
  storeName: string;
  staffName: string;
  staffEmail: string;
  ordersBadge: number;
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setNavOpen(false), [pathname]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const nav: NavItem[] = [
    { label: 'Home', href: '/admin', icon: HomeIcon, exact: true },
    {
      label: 'Orders',
      href: '/admin/orders',
      icon: OrdersIcon,
      badge: ordersBadge,
      children: [{ label: 'Abandoned carts', href: '/admin/orders/abandoned' }]
    },
    {
      label: 'Products',
      href: '/admin/products',
      icon: ProductsIcon,
      children: [{ label: 'Collections', href: '/admin/collections' }]
    },
    { label: 'Customers', href: '/admin/customers', icon: CustomersIcon },
    { label: 'Discounts', href: '/admin/discounts', icon: DiscountsIcon },
    {
      label: 'Analytics',
      href: '/admin/analytics',
      icon: AnalyticsIcon,
      children: [{ label: 'Live view', href: '/admin/analytics/live' }]
    },
    { label: 'Online store', href: '/admin/content', icon: StoreIcon }
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const initials = staffName
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  const sidebar = (
    <nav className="flex h-full flex-col gap-0.5 px-3 py-3" aria-label="Admin">
      {nav.map((item) => {
        const productsSection =
          item.children && (isActive(item.href) || item.children.some((c) => isActive(c.href)));
        const active = isActive(item.href, item.exact) && !item.children?.some((c) => isActive(c.href));
        const Icon = item.icon;
        return (
          <div key={item.href}>
            <Link
              href={item.href}
              className={clsx(
                'flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] font-semibold',
                // A sub-page (e.g. Abandoned carts) highlights itself, not its parent too.
                active
                  ? 'bg-white text-admin-text shadow-[0_1px_0_rgba(0,0,0,0.05)]'
                  : 'text-[#303030] hover:bg-black/5'
              )}
            >
              <Icon width={18} height={18} />
              <span className="flex-1">{item.label}</span>
              {!!item.badge && (
                <span className="rounded-md bg-[#e3e3e3] px-1.5 text-[11px] font-semibold leading-5">{item.badge}</span>
              )}
            </Link>
            {item.children && productsSection && (
              <div className="mt-0.5 flex flex-col gap-0.5">
                {item.children.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className={clsx(
                      'flex h-7 items-center rounded-lg pl-[34px] text-[13px] font-medium',
                      isActive(c.href) ? 'bg-white text-admin-text' : 'text-admin-subdued hover:bg-black/5'
                    )}
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="mt-4 px-2 text-[12px] font-semibold text-admin-subdued">Sales channels</div>
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] font-semibold text-[#303030] hover:bg-black/5"
      >
        <ExternalIcon width={18} height={18} />
        Online Store
      </a>

      <div className="mt-auto">
        <Link
          href="/admin/settings"
          className={clsx(
            'flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] font-semibold',
            isActive('/admin/settings') ? 'bg-white' : 'hover:bg-black/5'
          )}
        >
          <SettingsIcon width={18} height={18} />
          Settings
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 bg-admin-top px-3 text-white">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 md:hidden"
          onClick={() => setNavOpen((o) => !o)}
          aria-label="Toggle navigation"
        >
          {navOpen ? <XIcon /> : <MenuIcon />}
        </button>
        <Link href="/admin" className="flex items-center gap-2 md:w-[216px]">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 text-[13px] font-bold">
            {storeName.trim().charAt(0).toUpperCase() || 'S'}
          </span>
          <span className="hidden truncate text-[13px] font-semibold sm:inline">{storeName}</span>
        </Link>

        <form
          role="search"
          className="mx-auto hidden w-full max-w-[480px] md:block"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get('q')?.toString().trim();
            if (q) router.push(`/admin/search?q=${encodeURIComponent(q)}`);
          }}
        >
          <label className="flex h-9 items-center gap-2 rounded-lg border border-[#4a4a4a] bg-[#303030] px-3 text-[#b5b5b5] focus-within:border-[#8a8a8a]">
            <SearchIcon width={16} height={16} />
            <input
              name="q"
              placeholder="Search"
              className="w-full bg-transparent text-[13px] text-white placeholder:text-[#b5b5b5] focus:outline-none"
            />
          </label>
        </form>

        <div className="relative ml-auto" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/10"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="hidden text-[13px] font-medium sm:inline">{staffName}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#36fba1] text-[11px] font-bold text-[#0c5132]">
              {initials || 'A'}
            </span>
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="admin-card absolute right-0 top-11 z-50 w-60 p-1.5 text-admin-text"
            >
              <div className="px-2 py-1.5">
                <div className="text-[13px] font-semibold">{staffName}</div>
                <div className="truncate text-[12px] text-admin-subdued">{staffEmail}</div>
              </div>
              <div className="my-1 border-t border-admin-border" />
              <Link href="/admin/account" className="block rounded-lg px-2 py-1.5 hover:bg-admin-hover" role="menuitem">
                Your account
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-admin-hover"
                >
                  <LogoutIcon width={16} height={16} /> Log out
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Sidebar — desktop */}
      <aside className="fixed bottom-0 left-0 top-14 z-30 hidden w-[240px] bg-admin-nav md:block">{sidebar}</aside>

      {/* Sidebar — mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 top-14 z-30 md:hidden">
          <button className="absolute inset-0 bg-black/40" aria-label="Close navigation" onClick={() => setNavOpen(false)} />
          <aside className="relative h-full w-[260px] bg-admin-nav">{sidebar}</aside>
        </div>
      )}

      <main className="pt-14 md:pl-[240px]">{children}</main>
    </div>
  );
}
