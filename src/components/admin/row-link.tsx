'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

/** Whole-row click target for index tables (keeps the table markup server-rendered). */
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className="cursor-pointer"
      onClick={() => router.push(href)}
      onKeyDown={(e) => e.key === 'Enter' && router.push(href)}
      tabIndex={0}
      role="link"
    >
      {children}
    </tr>
  );
}
