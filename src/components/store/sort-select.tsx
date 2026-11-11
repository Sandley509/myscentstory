'use client';

import { sorting } from '@/lib/constants';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get('sort') ?? '';

  return (
    <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-muted">
      <span>Sort by</span>
      <select
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set('sort', e.target.value);
          else next.delete('sort');
          router.push(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
        }}
        className="h-9 border border-line bg-page px-2 text-[11px] uppercase tracking-[0.08em] text-fg outline-none"
      >
        {sorting.map((s) => (
          <option key={s.title} value={s.slug ?? ''}>
            {s.title === 'Relevance' ? 'Featured' : s.title}
          </option>
        ))}
      </select>
    </label>
  );
}
