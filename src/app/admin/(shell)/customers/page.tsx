import { CustomersIcon } from '@/components/admin/icons';
import { ListSearch } from '@/components/admin/list-search';
import { RowLink } from '@/components/admin/row-link';
import { Badge, ButtonLink, Card, EmptyState, Page, Pagination } from '@/components/admin/ui';
import { requireStaffPage } from '@/lib/admin/auth';
import { customerName, formatMoney } from '@/lib/admin/format';
import type { CustomerRow } from '@/lib/commerce/db';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Customers' };
const PAGE_SIZE = 50;

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export default async function CustomersPage({ searchParams }: Props) {
  const { q = '', page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { supabase } = await requireStaffPage();

  let query = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const term = q.replace(/[%,()]/g, ' ').trim();
  if (term) query = query.or(`email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%`);

  const [{ data }, { data: settings }, { count }] = await Promise.all([
    query,
    supabase.from('store_settings').select('currency').eq('id', 1).maybeSingle(),
    supabase.from('customers').select('id', { count: 'exact', head: true })
  ]);
  const rows = (data ?? []) as CustomerRow[];
  const ids = rows.map((r) => r.id);
  const { data: statsData } = ids.length
    ? await supabase.from('customer_stats').select('*').in('id', ids)
    : { data: [] as { id: string; orders_count: number; total_spent: number }[] };
  const stats = new Map((statsData ?? []).map((s) => [s.id as string, s]));
  const currency = settings?.currency ?? 'CAD';

  const addAction = <ButtonLink href="/admin/customers/new" variant="primary">Add customer</ButtonLink>;

  return (
    <Page title="Customers" subtitle={count ? `${count} customer${count === 1 ? '' : 's'}` : undefined} primaryAction={addAction}>
      <Card flush>
        {count === 0 ? (
          <EmptyState icon={<CustomersIcon width={48} height={48} />} heading="Everything customers-related in one place" action={addAction}>
            Customers are created automatically when someone completes checkout.
          </EmptyState>
        ) : (
          <>
            <ListSearch placeholder="Search customers" defaultValue={q} />
            <div className="overflow-x-auto">
              <table className="admin-table w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th>Customer name</th>
                    <th>Email subscription</th>
                    <th>Location</th>
                    <th>Orders</th>
                    <th className="text-right">Amount spent</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PAGE_SIZE).map((c) => {
                    const s = stats.get(c.id);
                    const loc = [c.default_address?.city, c.default_address?.state, c.default_address?.country].filter(Boolean).join(', ');
                    return (
                      <RowLink key={c.id} href={`/admin/customers/${c.id}`}>
                        <td>
                          <div className="font-semibold">{customerName(c)}</div>
                          <div className="text-admin-subdued">{c.email}</div>
                        </td>
                        <td>{c.accepts_marketing ? <Badge tone="success">Subscribed</Badge> : <Badge>Not subscribed</Badge>}</td>
                        <td className="text-admin-subdued">{loc}</td>
                        <td>{Number(s?.orders_count ?? 0)} orders</td>
                        <td className="text-right">{formatMoney(s?.total_spent ?? 0, currency)}</td>
                      </RowLink>
                    );
                  })}
                </tbody>
              </table>
              {!rows.length && <p className="px-4 py-10 text-center text-admin-subdued">No customers found</p>}
            </div>
            <Pagination
              page={page}
              hasNext={rows.length > PAGE_SIZE}
              hrefFor={(p) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`}
            />
          </>
        )}
      </Card>
    </Page>
  );
}
