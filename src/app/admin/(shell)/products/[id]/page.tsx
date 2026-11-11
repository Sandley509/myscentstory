import { ProductForm } from '@/components/admin/product-form';
import { requireStaffPage } from '@/lib/admin/auth';
import type { ProductWithRelations } from '@/lib/commerce/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadProductFormData, toProductInput } from '../load';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await requireStaffPage();
  const { data } = await supabase.from('products').select('title').eq('id', id).maybeSingle();
  return { title: data?.title ?? 'Product' };
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireStaffPage();

  const [{ data: product }, { data: links }, formData] = await Promise.all([
    supabase.from('products').select('*, product_images(*), product_variants(*)').eq('id', id).maybeSingle(),
    supabase.from('collection_products').select('collection_id').eq('product_id', id),
    loadProductFormData(supabase)
  ]);
  if (!product) notFound();

  const p = product as ProductWithRelations;
  return (
    <ProductForm
      key={p.updated_at}
      initial={toProductInput(p, (links ?? []).map((l) => l.collection_id as string))}
      collections={formData.collections}
      suggestions={formData.suggestions}
      currency={formData.currency}
      storefrontUrl={`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/products/${p.handle}`}
    />
  );
}
