import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function productsForPicker(db: SupabaseClient) {
  const { data } = await db
    .from('products')
    .select('id, title, status, product_images(url, position)')
    .order('title')
    .limit(2000);
  return (data ?? []).map((p) => ({
    id: p.id as string,
    title: p.title as string,
    status: p.status as string,
    image:
      ([...((p.product_images as { url: string; position: number }[]) ?? [])].sort((a, b) => a.position - b.position)[0]
        ?.url ?? null)
  }));
}
