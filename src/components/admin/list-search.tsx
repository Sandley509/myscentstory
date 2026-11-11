'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SearchIcon } from './icons';

/** Search box for index pages — updates `?q=` (debounced), keeps other params. */
export function ListSearch({ placeholder, defaultValue = '' }: { placeholder: string; defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (value === (params.get('q') ?? '')) return;
    const t = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (value.trim()) sp.set('q', value.trim());
      else sp.delete('q');
      sp.delete('page');
      router.replace(`${pathname}${sp.size ? `?${sp}` : ''}`);
    }, 300);
    return () => clearTimeout(t);
  }, [value, params, pathname, router]);

  return (
    <div className="border-b border-admin-border px-2 py-2">
      <label className="flex h-8 items-center gap-2 rounded-lg border border-[#8a8a8a] bg-white px-2.5 focus-within:border-admin-focus focus-within:shadow-[0_0_0_1px_var(--color-admin-focus)]">
        <SearchIcon width={16} height={16} className="text-admin-subdued" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#8a8a8a]"
        />
      </label>
    </div>
  );
}
