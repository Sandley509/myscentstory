import { CollectionForm } from '@/components/admin/collection-form';
import { requireStaffPage } from '@/lib/admin/auth';
import type { CollectionRow } from '@/lib/commerce/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { productsForPicker } from '../products-for-picker';

export const metadata: Metadata = { title: 'Collection' };

type Props = { params: Promise<{ id: string }> };

export default async function EditCollectionPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireStaffPage();
  const [{ data }, { data: links }, products] = await Promise.all([
    supabase.from('collections').select('*').eq('id', id).maybeSingle(),
    supabase.from('collection_products').select('product_id, position').eq('collection_id', id).order('position'),
    productsForPicker(supabase)
  ]);
  if (!data) notFound();
  const c = data as CollectionRow;

  return (
    <CollectionForm
      key={c.updated_at}
      products={products}
      initial={{
        id: c.id,
        title: c.title,
        handle: c.handle,
        description: c.description ?? '',
        image_url: c.image_url,
        published: c.published,
        sort_order: c.sort_order,
        seo_title: c.seo_title ?? '',
        seo_description: c.seo_description ?? '',
        product_ids: (links ?? []).map((l) => l.product_id as string)
      }}
    />
  );
}
