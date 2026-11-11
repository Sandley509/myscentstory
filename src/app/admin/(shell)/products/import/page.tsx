import { ImportForm } from '@/components/admin/import-form';
import { requireStaffPage } from '@/lib/admin/auth';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Import products' };

export default async function ImportProductsPage() {
  const { supabase } = await requireStaffPage();
  const { data } = await supabase.from('store_settings').select('currency').eq('id', 1).maybeSingle();
  return <ImportForm currency={(data?.currency as string) ?? 'CAD'} />;
}
