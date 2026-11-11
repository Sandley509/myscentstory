import { ProductsIcon } from '@/components/admin/icons';
import { ButtonLink, Card, EmptyState, Page, Pagination, Tabs } from '@/components/admin/ui';
import { requireStaffPage } from '@/lib/admin/auth';
import type { ProductWithRelations } from '@/lib/commerce/db';
import type { Metadata } from 'next';
import { ListSearch } from '@/components/admin/list-search';
import { ProductsTable, type ProductListRow } from './products-table';

export const metadata: Metadata = { title: 'Products' };

const PAGE_SIZE = 50;

type Props = { searchParams: Promise<{ status?: string; q?: string; page?: string }> };

export default async function ProductsPage({ searchParams }: Props) {
  const { status = 'all', q = '', page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { supabase } = await requireStaffPage();

  let query = supabase
    .from('products')
    .select('*, product_images(url, position), product_variants(inventory_quantity, track_inventory)')
    .order('updated_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (['active', 'draft', 'archived'].includes(status)) query = query.eq('status', status);
  const term = q.replace(/[%,()]/g, ' ').trim();
  if (term) query = query.or(`title.ilike.%${term}%,product_type.ilike.%${term}%,vendor.ilike.%${term}%`);

  const { data, error } = await query;
  const rows = (data ?? []) as ProductWithRelations[];
  const hasNext = rows.length > PAGE_SIZE;

  const list: ProductListRow[] = rows.slice(0, PAGE_SIZE).map((p) => {
    const variants = p.product_variants ?? [];
    const tracked = variants.filter((v) => v.track_inventory);
    const img = [...(p.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      image: img?.url ?? null,
      inventory: tracked.length ? tracked.reduce((s, v) => s + v.inventory_quantity, 0) : null,
      variantCount: variants.length,
      type: p.product_type,
      vendor: p.vendor
    };
  });

  const tab = (value: string, label: string) => ({
    value,
    label,
    href: `/admin/products${value === 'all' ? '' : `?status=${value}`}`
  });

  const hrefFor = (p: number) => {
    const sp = new URLSearchParams();
    if (status !== 'all') sp.set('status', status);
    if (q) sp.set('q', q);
    sp.set('page', String(p));
    return `/admin/products?${sp}`;
  };

  const isEmptyStore = !q && status === 'all' && list.length === 0;

  return (
    <Page
      title="Products"
      secondaryActions={<ButtonLink href="/admin/products/import">Import</ButtonLink>}
      primaryAction={<ButtonLink href="/admin/products/new" variant="primary">Add product</ButtonLink>}
    >
      <Card flush>
        {isEmptyStore ? (
          <EmptyState
            icon={<ProductsIcon width={48} height={48} />}
            heading="Add your products"
            action={
              <div className="flex gap-2">
                <ButtonLink href="/admin/products/import">Import from Excel</ButtonLink>
                <ButtonLink href="/admin/products/new" variant="primary">Add product</ButtonLink>
              </div>
            }
          >
            Add your perfumes one by one, or import them all at once from an Excel sheet with their photos.
          </EmptyState>
        ) : (
          <>
            <Tabs
              current={status}
              tabs={[tab('all', 'All'), tab('active', 'Active'), tab('draft', 'Draft'), tab('archived', 'Archived')]}
            />
            <ListSearch placeholder="Search products" defaultValue={q} />
            {error && <p className="px-4 py-3 text-admin-critical">{error.message}</p>}
            <ProductsTable rows={list} />
            <Pagination page={page} hasNext={hasNext} hrefFor={hrefFor} />
          </>
        )}
      </Card>
    </Page>
  );
}
