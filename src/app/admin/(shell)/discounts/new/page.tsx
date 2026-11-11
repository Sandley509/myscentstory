import { DiscountForm } from '@/components/admin/discount-form';
import { requireStaffPage } from '@/lib/admin/auth';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create discount' };

export default async function NewDiscountPage() {
  const { supabase } = await requireStaffPage();
  const { data: settings } = await supabase.from('store_settings').select('currency').eq('id', 1).maybeSingle();
  return (
    <DiscountForm
      currency={settings?.currency ?? 'CAD'}
      initial={{
        code: '',
        type: 'percentage',
        value: '',
        min_subtotal: '',
        usage_limit: '',
        starts_at: new Date().toISOString(),
        ends_at: '',
        active: true,
        first_order_only: false,
        once_per_customer: false
      }}
    />
  );
}
