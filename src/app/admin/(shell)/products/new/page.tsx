import { ProductForm } from '@/components/admin/product-form';
import { requireStaffPage } from '@/lib/admin/auth';
import type { Metadata } from 'next';
import { loadProductFormData } from '../load';

export const metadata: Metadata = { title: 'Add product' };

export default async function NewProductPage() {
  const { supabase } = await requireStaffPage();
  const { collections, suggestions, currency } = await loadProductFormData(supabase);

  return (
    <ProductForm
      collections={collections}
      suggestions={suggestions}
      currency={currency}
      initial={{
        title: '',
        handle: '',
        description_html: '',
        status: 'active',
        product_type: '',
        vendor: '',
        tags: [],
        seo_title: '',
        seo_description: '',
        gender: '',
        concentration: '',
        scent_family: '',
        top_notes: [],
        heart_notes: [],
        base_notes: [],
        options: [],
        variants: [
          {
            option1: null,
            option2: null,
            option3: null,
            price: '0.00',
            compare_at_price: '',
            sku: '',
            barcode: '',
            inventory_quantity: 0,
            track_inventory: false,
            continue_selling: false
          }
        ],
        images: [],
        collection_ids: []
      }}
    />
  );
}
