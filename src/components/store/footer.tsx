import type { StoreSettingsRow } from '@/lib/commerce/db';
import { toNumber } from '@/lib/commerce/pricing';
import type { Collection } from '@/lib/commerce/types';
import type { SiteContent } from '@/lib/content';
import { POLICY_LINKS, SITE } from '@/lib/site';
import Image from 'next/image';
import Link from 'next/link';
import { FacebookIcon, GiftIcon, InstagramIcon, LockIcon, ReturnIcon, TikTokIcon, TruckIcon } from './icons';
import { NewsletterForm } from './newsletter-form';
import { Money } from './currency';
import type { ReactNode } from 'react';

export function Footer({
  settings,
  collections,
  social
}: {
  settings: StoreSettingsRow;
  collections: Collection[];
  social: SiteContent['social'];
}) {
  const storeName = settings.store_name || SITE.name;
  const threshold = toNumber(settings.free_shipping_threshold);
  const flat = toNumber(settings.shipping_flat_rate);

  const perks: { icon: typeof TruckIcon; title: ReactNode }[] = [
    {
      icon: TruckIcon,
      title:
        threshold > 0 ? (
          <>
            Free shipping over <Money amount={threshold} currencyCode={settings.currency} />
          </>
        ) : (
          <>
            <Money amount={flat} currencyCode={settings.currency} /> flat-rate shipping
          </>
        )
    },
    { icon: ReturnIcon, title: `${SITE.returns.days}-day returns` },
    { icon: GiftIcon, title: 'Friendly customer care' },
    { icon: LockIcon, title: 'Easy & secure checkout' }
  ];

  const socials = [
    { href: social.instagram, label: 'Instagram', icon: InstagramIcon },
    { href: social.facebook, label: 'Facebook', icon: FacebookIcon },
    { href: social.tiktok, label: 'TikTok', icon: TikTokIcon }
  ].filter((s) => s.href);

  const columns = [
    {
      title: `Shop ${storeName}`,
      links: [
        { title: 'All perfumes', path: '/collections/all' },
        ...collections.filter((c) => c.handle).slice(0, 5).map((c) => ({ title: c.title, path: c.path }))
      ]
    },
    {
      title: 'Customer service',
      links: [
        { title: 'Contact us', path: '/pages/contact' },
        ...POLICY_LINKS.slice(0, 3)
      ]
    },
    {
      title: 'About',
      links: [{ title: 'Our story', path: '/pages/about' }, ...POLICY_LINKS.slice(3)]
    }
  ];

  return (
    <footer className="mt-20 bg-black text-white">
      <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-6 border-b border-white/15 px-4 py-8 lg:grid-cols-4">
        {perks.map(({ icon: Icon, title }, i) => (
          <li key={i} className="flex items-center gap-3">
            <Icon width={28} height={28} className="shrink-0" />
            <span className="text-[11px] font-bold uppercase leading-snug tracking-[0.12em]">{title}</span>
          </li>
        ))}
      </ul>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-[2fr_1fr]">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.14em]">{col.title}</h2>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.path}>
                    <Link href={l.path} className="text-xs uppercase tracking-[0.1em] text-neutral-300 hover:text-white">
                      {l.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div>
          <NewsletterForm />
          {(settings.contact_email || settings.phone) && (
            <div className="mt-8 text-xs text-neutral-300">
              <h2 className="mb-2 font-bold uppercase tracking-[0.14em] text-white">Contact us</h2>
              {settings.contact_email && (
                <p>
                  <a href={`mailto:${settings.contact_email}`} className="underline">{settings.contact_email}</a>
                </p>
              )}
              {settings.phone && <p className="mt-1">{settings.phone}</p>}
            </div>
          )}
          {socials.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em]">Follow us</h2>
              <ul className="flex gap-4">
                {socials.map(({ href, label, icon: Icon }) => (
                  <li key={label}>
                    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="hover:text-accent">
                      <Icon width={22} height={22} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-6 text-[11px] text-neutral-400 md:flex-row md:justify-between">
          <Image src="/logo-white.png" alt="" width={900} height={380} className="h-9 w-auto" />
          <p>© {new Date().getFullYear()} {SITE.legalName}</p>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            {POLICY_LINKS.map((l) => (
              <li key={l.path}>
                <Link href={l.path} className="hover:text-white">{l.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
