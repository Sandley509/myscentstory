import { CollectionForm } from '@/components/admin/collection-form';
import { requireStaffPage } from '@/lib/admin/auth';
import type { Metadata } from 'next';
import { productsForPicker } from '../products-for-picker';

export const metadata: Metadata = { title: 'Create collection' };

export default async function NewCollectionPage() {
  const { supabase } = await requireStaffPage();
  return (
    <CollectionForm
      products={await productsForPicker(supabase)}
      initial={{
        title: '',
        handle: '',
        description: '',
        image_url: null,
        published: true,
        sort_order: 0,
        seo_title: '',
        seo_description: '',
        product_ids: []
      }}
    />
  );
}
