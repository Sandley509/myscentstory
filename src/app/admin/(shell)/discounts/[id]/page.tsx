import { DiscountForm } from '@/components/admin/discount-form';
import { requireStaffPage } from '@/lib/admin/auth';
import type { DiscountRow } from '@/lib/commerce/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Discount' };

type Props = { params: Promise<{ id: string }> };

export default async function DiscountPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireStaffPage();
  const [{ data }, { data: settings }] = await Promise.all([
    supabase.from('discounts').select('*').eq('id', id).maybeSingle(),
    supabase.from('store_settings').select('currency').eq('id', 1).maybeSingle()
  ]);
  if (!data) notFound();
  const d = data as DiscountRow;
  const n = (v: number | string | null) => (v === null ? '' : String(Number(v)));

  return (
    <DiscountForm
      key={d.id}
      currency={settings?.currency ?? 'CAD'}
      usageCount={d.usage_count}
      initial={{
        id: d.id,
        code: d.code,
        type: d.type,
        value: d.type === 'free_shipping' ? '' : n(d.value),
        min_subtotal: n(d.min_subtotal),
        usage_limit: d.usage_limit === null ? '' : String(d.usage_limit),
        starts_at: d.starts_at,
        ends_at: d.ends_at ?? '',
        active: d.active,
        first_order_only: !!d.first_order_only,
        once_per_customer: !!d.once_per_customer
      }}
    />
  );
}
