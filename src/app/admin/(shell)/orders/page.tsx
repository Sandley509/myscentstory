import { OrdersIcon } from '@/components/admin/icons';
import { ListSearch } from '@/components/admin/list-search';
import { RecoverOrdersButton } from '@/components/admin/recover-orders-button';
import { Badge, Card, EmptyState, Page, Pagination, Tabs } from '@/components/admin/ui';
import { requireStaffPage } from '@/lib/admin/auth';
import { customerName, financialBadge, formatDate, formatMoney, fulfillmentBadge, orderStatusBadge } from '@/lib/admin/format';
import type { CustomerRow, OrderRow } from '@/lib/commerce/db';
import type { Metadata } from 'next';
import { RowLink } from '@/components/admin/row-link';

export const metadata: Metadata = { title: 'Orders' };

const PAGE_SIZE = 50;

type Props = { searchParams: Promise<{ view?: string; q?: string; page?: string }> };

type Row = OrderRow & {
  customers: Pick<CustomerRow, 'first_name' | 'last_name' | 'email'> | null;
  order_line_items: { quantity: number }[];
};

export default async function OrdersPage({ searchParams }: Props) {
  const { view = 'all', q = '', page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { supabase } = await requireStaffPage();

  let query = supabase
    .from('orders')
    .select('*, customers(first_name, last_name, email), order_line_items(quantity)')
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  switch (view) {
    case 'unfulfilled':
      query = query.eq('status', 'open').neq('fulfillment_status', 'fulfilled').in('financial_status', ['paid', 'partially_refunded']);
      break;
    case 'unpaid':
      query = query.eq('financial_status', 'pending').neq('status', 'cancelled');
      break;
    case 'open':
      query = query.eq('status', 'open');
      break;
    case 'archived':
      query = query.eq('status', 'archived');
      break;
    case 'cancelled':
      query = query.eq('status', 'cancelled');
      break;
  }

  const term = q.replace(/[#%,()]/g, ' ').trim();
  if (term) {
    query = /^\d+$/.test(term) ? query.eq('order_number', Number(term)) : query.ilike('email', `%${term}%`);
  }

  const { data } = await query;
  const rows = (data ?? []) as Row[];
  const hasNext = rows.length > PAGE_SIZE;

  const tab = (value: string, label: string) => ({
    value,
    label,
    href: `/admin/orders${value === 'all' ? '' : `?view=${value}`}`
  });

  const { count: total } = await supabase.from('orders').select('id', { count: 'exact', head: true });

  return (
    <Page title="Orders" secondaryActions={total ? <RecoverOrdersButton /> : undefined}>
      <Card flush>
        {total === 0 ? (
          <EmptyState icon={<OrdersIcon width={48} height={48} />} heading="Your orders will show here">
            <p>When customers pay through Stripe Checkout, their orders appear here automatically.</p>
            <p className="mt-3">Paid on Stripe but nothing here? The webhook didn’t arrive — this brings those orders in:</p>
            <div className="mt-3 flex justify-center">
              <RecoverOrdersButton />
            </div>
          </EmptyState>
        ) : (
          <>
            <Tabs
              current={view}
              tabs={[
                tab('all', 'All'),
                tab('unfulfilled', 'Unfulfilled'),
                tab('unpaid', 'Unpaid'),
                tab('open', 'Open'),
                tab('archived', 'Archived'),
                tab('cancelled', 'Canceled')
              ]}
            />
            <ListSearch placeholder="Search by order number or email" defaultValue={q} />
            <div className="overflow-x-auto">
              <table className="admin-table w-full min-w-[860px]">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th className="text-right">Total</th>
                    <th>Payment status</th>
                    <th>Fulfillment status</th>
                    <th>Items</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PAGE_SIZE).map((o) => {
                    const fin = financialBadge[o.financial_status];
                    const ful = fulfillmentBadge[o.fulfillment_status];
                    const st = orderStatusBadge[o.status];
                    const items = o.order_line_items.reduce((s, i) => s + i.quantity, 0);
                    return (
                      <RowLink key={o.id} href={`/admin/orders/${o.id}`}>
                        <td className="font-semibold">
                          <span className={o.status === 'cancelled' ? 'line-through' : ''}>#{o.order_number}</span>
                        </td>
                        <td className="whitespace-nowrap text-admin-subdued">{formatDate(o.created_at)}</td>
                        <td>{o.customers ? customerName(o.customers) : o.email ?? 'No customer'}</td>
                        <td className="whitespace-nowrap text-right">{formatMoney(o.total, o.currency)}</td>
                        <td>
                          <Badge tone={fin.tone} dot={fin.dot}>{fin.label}</Badge>
                        </td>
                        <td>
                          <span className="flex gap-1">
                            {st ? <Badge tone={st.tone}>{st.label}</Badge> : <Badge tone={ful.tone} dot={ful.dot}>{ful.label}</Badge>}
                          </span>
                        </td>
                        <td className="whitespace-nowrap text-admin-subdued">
                          {items} item{items === 1 ? '' : 's'}
                        </td>
                      </RowLink>
                    );
                  })}
                </tbody>
              </table>
              {!rows.length && <p className="px-4 py-10 text-center text-admin-subdued">No orders found</p>}
            </div>
            <Pagination
              page={page}
              hasNext={hasNext}
              hrefFor={(p) => {
                const sp = new URLSearchParams();
                if (view !== 'all') sp.set('view', view);
                if (q) sp.set('q', q);
                sp.set('page', String(p));
                return `/admin/orders?${sp}`;
              }}
            />
          </>
        )}
      </Card>
    </Page>
  );
}
