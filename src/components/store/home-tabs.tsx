'use client';

import type { Product } from '@/lib/commerce/types';
import Link from 'next/link';
import { useState } from 'react';
import { ProductGrid } from './product-card';

type Tab = { label: string; href: string; products: Product[] };

/**
 * "Best sellers / New / Gift sets" switcher. Every panel is in the HTML from
 * the first render (inactive ones are just hidden), so search engines see all
 * the products and links, not only the first tab.
 */
export function HomeTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);
  if (!tabs.length) return null;

  return (
    <div>
      <div role="tablist" aria-label="Featured perfumes" className="mb-8 flex justify-center gap-8">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            role="tab"
            type="button"
            id={`home-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`home-panel-${i}`}
            onClick={() => setActive(i)}
            className={`border-b-2 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] ${
              i === active ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.label} role="tabpanel" id={`home-panel-${i}`} aria-labelledby={`home-tab-${i}`} hidden={i !== active}>
          <ProductGrid products={t.products} />
          <div className="mt-10 text-center">
            <Link href={t.href} className="btn-outline">
              View all {t.label.toLowerCase()}
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
