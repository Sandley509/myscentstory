import { DiscountsIcon } from '@/components/admin/icons';
import { RowLink } from '@/components/admin/row-link';
import { Badge, ButtonLink, Card, EmptyState, Page } from '@/components/admin/ui';
import { requireStaffPage } from '@/lib/admin/auth';
import { formatMoney } from '@/lib/admin/format';
import type { DiscountRow } from '@/lib/commerce/db';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Discounts' };

function status(d: DiscountRow) {
  const now = Date.now();
  if (!d.active) return <Badge>Paused</Badge>;
  if (new Date(d.starts_at).getTime() > now) return <Badge tone="info">Scheduled</Badge>;
  if (d.ends_at && new Date(d.ends_at).getTime() < now) return <Badge>Expired</Badge>;
  if (d.usage_limit !== null && d.usage_count >= d.usage_limit) return <Badge>Limit reached</Badge>;
  return <Badge tone="success">Active</Badge>;
}

export default async function DiscountsPage() {
  const { supabase } = await requireStaffPage();
  const [{ data }, { data: settings }] = await Promise.all([
    supabase.from('discounts').select('*').order('created_at', { ascending: false }),
    supabase.from('store_settings').select('currency').eq('id', 1).maybeSingle()
  ]);
  const rows = (data ?? []) as DiscountRow[];
  const currency = settings?.currency ?? 'CAD';
  const action = <ButtonLink href="/admin/discounts/new" variant="primary">Create discount</ButtonLink>;

  const describe = (d: DiscountRow) =>
    d.type === 'percentage'
      ? `${Number(d.value)}% off entire order`
      : d.type === 'fixed_amount'
        ? `${formatMoney(d.value, currency)} off entire order`
        : 'Free shipping';

  return (
    <Page title="Discounts" primaryAction={action}>
      <Card flush>
        {!rows.length ? (
          <EmptyState icon={<DiscountsIcon width={48} height={48} />} heading="Manage discounts and promotions" action={action}>
            Create discount codes customers can enter in their cart — percentage off, a fixed amount, or free shipping.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table w-full min-w-[600px]">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th className="text-right">Used</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <RowLink key={d.id} href={`/admin/discounts/${d.id}`}>
                    <td>
                      <div className="font-semibold">{d.code}</div>
                      <div className="text-admin-subdued">{describe(d)}</div>
                    </td>
                    <td>{status(d)}</td>
                    <td className="text-admin-subdued">Discount code</td>
                    <td className="text-right">{d.usage_count}</td>
                  </RowLink>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}
