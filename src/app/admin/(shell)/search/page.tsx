import { Card, Page, Thumbnail } from '@/components/admin/ui';
import { requireStaffPage } from '@/lib/admin/auth';
import { customerName, formatDate, formatMoney } from '@/lib/admin/format';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Search' };

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = '' } = await searchParams;
  const term = q.replace(/[#%,()]/g, ' ').trim();
  const { supabase } = await requireStaffPage();

  const [products, orders, customers] = term
    ? await Promise.all([
        supabase.from('products').select('id, title, status, product_images(url, position)').ilike('title', `%${term}%`).limit(8),
        /^\d+$/.test(term)
          ? supabase.from('orders').select('id, order_number, email, total, currency, created_at').eq('order_number', Number(term)).limit(8)
          : supabase.from('orders').select('id, order_number, email, total, currency, created_at').ilike('email', `%${term}%`).order('created_at', { ascending: false }).limit(8),
        supabase
          .from('customers')
          .select('id, first_name, last_name, email')
          .or(`email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
          .limit(8)
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const P = (products.data ?? []) as { id: string; title: string; status: string; product_images: { url: string; position: number }[] }[];
  const O = (orders.data ?? []) as { id: string; order_number: number; email: string | null; total: number; currency: string; created_at: string }[];
  const C = (customers.data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string }[];
  const none = !P.length && !O.length && !C.length;

  return (
    <Page title={term ? `Results for “${q}”` : 'Search'} narrow>
      <div className="flex flex-col gap-4">
        {none && <Card><p className="text-admin-subdued">{term ? 'No results found.' : 'Type in the search bar above.'}</p></Card>}
        {P.length > 0 && (
          <Card title="Products" flush>
            <ul className="mt-3 border-t border-admin-border">
              {P.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 border-b border-admin-border px-4 py-2 last:border-0 hover:bg-admin-hover">
                    <Thumbnail src={[...p.product_images].sort((a, b) => a.position - b.position)[0]?.url} size={32} />
                    <span className="font-medium">{p.title}</span>
                    <span className="ml-auto text-admin-subdued capitalize">{p.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {O.length > 0 && (
          <Card title="Orders" flush>
            <ul className="mt-3 border-t border-admin-border">
              {O.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 border-b border-admin-border px-4 py-2 hover:bg-admin-hover">
                    <span className="font-semibold">#{o.order_number}</span>
                    <span className="text-admin-subdued">{o.email}</span>
                    <span className="ml-auto text-admin-subdued">{formatDate(o.created_at)}</span>
                    <span>{formatMoney(o.total, o.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {C.length > 0 && (
          <Card title="Customers" flush>
            <ul className="mt-3 border-t border-admin-border">
              {C.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-3 border-b border-admin-border px-4 py-2 hover:bg-admin-hover">
                    <span className="font-medium">{customerName(c)}</span>
                    <span className="text-admin-subdued">{c.email}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Page>
  );
}
