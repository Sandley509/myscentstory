'use client';

import { Toast } from '@/components/admin/overlays';
import { Badge, Button, Thumbnail } from '@/components/admin/ui';
import { deleteProducts, setProductsStatus } from '@/lib/admin/actions/products';
import type { ProductStatus } from '@/lib/commerce/db';
import clsx from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export type ProductListRow = {
  id: string;
  title: string;
  status: ProductStatus;
  image: string | null;
  inventory: number | null;
  variantCount: number;
  type: string | null;
  vendor: string | null;
};

export const productStatusBadge = (s: ProductStatus) =>
  s === 'active' ? <Badge tone="success">Active</Badge> : s === 'draft' ? <Badge tone="info">Draft</Badge> : <Badge>Archived</Badge>;

export function ProductsTable({ rows }: { rows: ProductListRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setToast({ msg });
        setSelected(new Set());
        router.refresh();
      } else setToast({ msg: res.error ?? 'Something went wrong', error: true });
    });

  if (!rows.length) {
    return <p className="px-4 py-10 text-center text-admin-subdued">No products found</p>;
  }

  const ids = [...selected];

  return (
    <>
      <div className="overflow-x-auto">
        <table className="admin-table w-full min-w-[720px]">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="h-4 w-4 accent-[#303030]"
                />
              </th>
              {selected.size > 0 ? (
                <th colSpan={5} className="!py-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-2 font-semibold text-admin-text">{selected.size} selected</span>
                    <Button size="slim" disabled={pending} onClick={() => run(() => setProductsStatus(ids, 'active'), 'Products set as active')}>Set as active</Button>
                    <Button size="slim" disabled={pending} onClick={() => run(() => setProductsStatus(ids, 'draft'), 'Products set as draft')}>Set as draft</Button>
                    <Button size="slim" disabled={pending} onClick={() => run(() => setProductsStatus(ids, 'archived'), 'Products archived')}>Archive</Button>
                    <Button
                      size="slim"
                      variant="critical"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`Delete ${selected.size} product(s)? This can’t be undone.`))
                          run(() => deleteProducts(ids), 'Products deleted');
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </th>
              ) : (
                <>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Inventory</th>
                  <th>Type</th>
                  <th>Vendor</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={clsx('cursor-pointer', selected.has(r.id) && '[&>td]:!bg-[#f1f1f1]')}
                onClick={() => router.push(`/admin/products/${r.id}`)}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.title}`}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="h-4 w-4 accent-[#303030]"
                  />
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <Thumbnail src={r.image} alt="" />
                    <Link href={`/admin/products/${r.id}`} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
                      {r.title}
                    </Link>
                  </div>
                </td>
                <td>{productStatusBadge(r.status)}</td>
                <td className={clsx(r.inventory !== null && r.inventory <= 0 && 'text-admin-critical')}>
                  {r.inventory === null ? (
                    <span className="text-admin-subdued">Inventory not tracked</span>
                  ) : (
                    `${r.inventory} in stock${r.variantCount > 1 ? ` for ${r.variantCount} variants` : ''}`
                  )}
                </td>
                <td className="text-admin-subdued">{r.type ?? ''}</td>
                <td className="text-admin-subdued">{r.vendor ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Toast message={toast?.msg ?? null} error={toast?.error} onDone={() => setToast(null)} />
    </>
  );
}
