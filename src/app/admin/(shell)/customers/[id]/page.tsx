import { CustomerForm } from '@/components/admin/customer-form';
import { RowLink } from '@/components/admin/row-link';
import { Badge, Card } from '@/components/admin/ui';
import { requireStaffPage } from '@/lib/admin/auth';
import { customerName, financialBadge, formatAddress, formatDate, formatMoney, fulfillmentBadge } from '@/lib/admin/format';
import type { CustomerRow, OrderRow } from '@/lib/commerce/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Customer' };

type Props = { params: Promise<{ id: string }> };

export default async function CustomerPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireStaffPage();

  const [{ data }, { data: stats }, { data: ordersData }, { data: settings }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).maybeSingle(),
    supabase.from('customer_stats').select('*').eq('id', id).maybeSingle(),
    supabase.from('orders').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('store_settings').select('currency').eq('id', 1).maybeSingle()
  ]);
  if (!data) notFound();
  const c = data as CustomerRow;
  const orders = (ordersData ?? []) as OrderRow[];
  const currency = settings?.currency ?? 'CAD';
  const spent = Number(stats?.total_spent ?? 0);
  const count = Number(stats?.orders_count ?? 0);
  const since = Math.max(0, Math.round((Date.now() - new Date(c.created_at).getTime()) / 86_400_000));

  const addressLines = formatAddress(c.default_address);

  return (
    <CustomerForm
      key={c.id}
      title={customerName(c)}
      subtitle={[c.default_address?.city, c.default_address?.country].filter(Boolean).join(', ') || undefined}
      initial={{
        id: c.id,
        email: c.email,
        first_name: c.first_name ?? '',
        last_name: c.last_name ?? '',
        phone: c.phone ?? '',
        accepts_marketing: c.accepts_marketing,
        note: c.note ?? '',
        tags: c.tags ?? []
      }}
      summary={
        <div className="admin-card mb-4 grid grid-cols-3 divide-x divide-admin-border">
          <div className="px-4 py-3">
            <div className="text-admin-subdued">Amount spent</div>
            <div className="text-[16px] font-semibold">{formatMoney(spent, currency)}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-admin-subdued">Orders</div>
            <div className="text-[16px] font-semibold">{count}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-admin-subdued">Customer since</div>
            <div className="text-[16px] font-semibold">{since === 0 ? 'Today' : `${since} day${since === 1 ? '' : 's'}`}</div>
          </div>
        </div>
      }
      orders={
        <Card title="Orders" flush>
          {orders.length === 0 ? (
            <p className="px-4 pb-4 text-admin-subdued">This customer hasn’t placed any orders yet.</p>
          ) : (
            <table className="admin-table w-full">
              <tbody>
                {orders.map((o) => {
                  const fin = financialBadge[o.financial_status];
                  const ful = fulfillmentBadge[o.fulfillment_status];
                  return (
                    <RowLink key={o.id} href={`/admin/orders/${o.id}`}>
                      <td className="font-semibold">#{o.order_number}</td>
                      <td className="text-admin-subdued">{formatDate(o.created_at)}</td>
                      <td>
                        <span className="flex flex-wrap gap-1">
                          <Badge tone={fin.tone} dot={fin.dot}>{fin.label}</Badge>
                          <Badge tone={ful.tone} dot={ful.dot}>{ful.label}</Badge>
                        </span>
                      </td>
                      <td className="text-right">{formatMoney(o.total, o.currency)}</td>
                    </RowLink>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      }
      address={
        <Card title="Default address">
          {addressLines.length ? (
            <address className="not-italic">
              {addressLines.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </address>
          ) : (
            <p className="text-admin-subdued">No address on file</p>
          )}
        </Card>
      }
    />
  );
}
