import { SalesChart } from '@/components/admin/sales-chart';
import { RowLink } from '@/components/admin/row-link';
import { Badge, Banner, ButtonLink, Card, Page, Thumbnail } from '@/components/admin/ui';
import { isMaintenanceMode } from '@/lib/maintenance';
import { requireStaffPage } from '@/lib/admin/auth';
import { customerName, financialBadge, formatDate, formatMoney, fulfillmentBadge } from '@/lib/admin/format';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Home' };

const TZ = 'America/Toronto';
const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });

export default async function AdminHome() {
  const { supabase, staff } = await requireStaffPage();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const prevSince = new Date(Date.now() - 60 * 86_400_000);

  const [{ data: orders }, { data: prev }, { data: recent }, { data: lowStock }, { count: newCustomers }, { data: settings }, { count: productCount }] =
    await Promise.all([
      supabase
        .from('orders')
        .select('total, refunded_total, created_at, financial_status')
        .gte('created_at', since.toISOString())
        .in('financial_status', ['paid', 'partially_refunded', 'refunded']),
      supabase
        .from('orders')
        .select('total, refunded_total')
        .gte('created_at', prevSince.toISOString())
        .lt('created_at', since.toISOString())
        .in('financial_status', ['paid', 'partially_refunded', 'refunded']),
      supabase
        .from('orders')
        .select('id, order_number, created_at, total, currency, financial_status, fulfillment_status, email, customers(first_name, last_name, email)')
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('product_variants')
        .select('id, title, inventory_quantity, products!inner(id, title, status, product_images(url, position))')
        .eq('track_inventory', true)
        .lte('inventory_quantity', 3)
        .eq('products.status', 'active')
        .order('inventory_quantity')
        .limit(5),
      supabase.from('customers').select('id', { count: 'exact', head: true }).gte('created_at', since.toISOString()),
      supabase.from('store_settings').select('currency, store_name').eq('id', 1).maybeSingle(),
      supabase.from('products').select('id', { count: 'exact', head: true })
    ]);

  const currency = settings?.currency ?? 'CAD';
  const net = (o: { total: number | string; refunded_total: number | string }) => Number(o.total) - Number(o.refunded_total);
  const sales = (orders ?? []).reduce((s, o) => s + net(o), 0);
  const prevSales = (prev ?? []).reduce((s, o) => s + net(o), 0);
  const count = orders?.length ?? 0;
  const aov = count ? sales / count : 0;
  const change = prevSales > 0 ? ((sales - prevSales) / prevSales) * 100 : null;

  // Daily buckets for the chart
  const buckets = new Map<string, { value: number; orders: number }>();
  for (let i = 29; i >= 0; i--) buckets.set(dayKey(new Date(Date.now() - i * 86_400_000)), { value: 0, orders: 0 });
  for (const o of orders ?? []) {
    const b = buckets.get(dayKey(new Date(o.created_at)));
    if (b) {
      b.value += net(o);
      b.orders += 1;
    }
  }
  const chart = [...buckets.entries()].map(([date, v]) => ({
    date,
    label: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ...v
  }));

  const { count: toFulfill } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')
    .in('financial_status', ['paid', 'partially_refunded'])
    .neq('fulfillment_status', 'fulfilled');

  const greeting = (() => {
    const h = Number(new Date().toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }));
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  })();

  type Recent = {
    id: string;
    order_number: number;
    created_at: string;
    total: number;
    currency: string;
    financial_status: keyof typeof financialBadge;
    fulfillment_status: keyof typeof fulfillmentBadge;
    email: string | null;
    customers: { first_name: string | null; last_name: string | null; email: string } | null;
  };
  type Low = {
    id: string;
    title: string;
    inventory_quantity: number;
    products: { id: string; title: string; product_images: { url: string; position: number }[] };
  };

  return (
    <Page title={`${greeting}, ${(staff.name || staff.email).split(/[\s@]/)[0]}`} subtitle="Here’s what’s happening with your store over the last 30 days.">
      <div className="flex flex-col gap-4">
        {isMaintenanceMode() && (
          <Banner tone="warning" title="Maintenance mode is on">
            Shoppers see a “back soon” page. You can still browse the store because you’re logged in. To reopen, set{' '}
            <code>MAINTENANCE_MODE=off</code> in your environment variables and redeploy.
          </Banner>
        )}
        <div className="admin-card grid grid-cols-2 divide-admin-border md:grid-cols-4 md:divide-x">
          {[
            { label: 'Total sales', value: formatMoney(sales, currency), sub: change === null ? null : `${change >= 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(0)}% vs previous 30 days` },
            { label: 'Orders', value: String(count) },
            { label: 'Average order value', value: formatMoney(aov, currency) },
            { label: 'New customers', value: String(newCustomers ?? 0) }
          ].map((k) => (
            <div key={k.label} className="px-4 py-3">
              <div className="text-admin-subdued">{k.label}</div>
              <div className="text-[20px] font-bold leading-7">{k.value}</div>
              {k.sub && <div className="text-[12px] text-admin-subdued">{k.sub}</div>}
            </div>
          ))}
        </div>

        {(toFulfill ?? 0) > 0 && (
          <Link href="/admin/orders?view=unfulfilled" className="admin-card flex items-center justify-between px-4 py-3 hover:bg-admin-hover">
            <span className="flex items-center gap-2 font-semibold">
              <Badge tone="warning" dot="incomplete">{toFulfill}</Badge>
              order{toFulfill === 1 ? '' : 's'} to fulfill
            </span>
            <span className="text-admin-subdued">›</span>
          </Link>
        )}

        {productCount === 0 && (
          <Card title="Set up your store">
            <p className="mb-3 text-admin-subdued">Add your first product so customers have something to buy.</p>
            <ButtonLink href="/admin/products/new" variant="primary">Add product</ButtonLink>
          </Card>
        )}

        <Card title="Sales per day">
          <SalesChart data={chart} currency={currency} />
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
          <Card title="Recent orders" actions={<Link href="/admin/orders" className="text-admin-link hover:underline">View all</Link>} flush>
            {(recent ?? []).length === 0 ? (
              <p className="px-4 pb-4 text-admin-subdued">No orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table w-full min-w-[520px]">
                  <tbody>
                    {(recent as unknown as Recent[]).map((o) => {
                      const fin = financialBadge[o.financial_status];
                      const ful = fulfillmentBadge[o.fulfillment_status];
                      return (
                        <RowLink key={o.id} href={`/admin/orders/${o.id}`}>
                          <td className="font-semibold">#{o.order_number}</td>
                          <td className="text-admin-subdued">{formatDate(o.created_at)}</td>
                          <td>{o.customers ? customerName(o.customers) : o.email}</td>
                          <td>
                            <span className="flex gap-1">
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
              </div>
            )}
          </Card>

          <Card title="Low stock" flush>
            {(lowStock ?? []).length === 0 ? (
              <p className="px-4 pb-4 text-admin-subdued">Nothing running low.</p>
            ) : (
              <ul className="mt-1">
                {(lowStock as unknown as Low[]).map((v) => (
                  <li key={v.id}>
                    <Link href={`/admin/products/${v.products.id}`} className="flex items-center gap-3 border-t border-admin-border px-4 py-2 hover:bg-admin-hover">
                      <Thumbnail size={32} src={[...(v.products.product_images ?? [])].sort((a, b) => a.position - b.position)[0]?.url} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{v.products.title}</span>
                        {v.title !== 'Default Title' && <span className="block text-admin-subdued">{v.title}</span>}
                      </span>
                      <span className={v.inventory_quantity <= 0 ? 'text-admin-critical' : ''}>{v.inventory_quantity}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}
