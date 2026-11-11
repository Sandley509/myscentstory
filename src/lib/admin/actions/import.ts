'use server';

import { action, requireStaff } from '@/lib/admin/auth';
import { runImport, type ImportItem } from '@/lib/admin/import-run';
import { TAGS } from '@/lib/constants';
import { revalidatePath, revalidateTag } from 'next/cache';

export type { ImportItem, ImportOutcome } from '@/lib/admin/import-run';

/**
 * Creates or updates a batch of products from the import page.
 * A product whose handle already exists is updated, not duplicated; its
 * existing photos are kept.
 */
export async function importProducts(items: ImportItem[]) {
  return action(async () => {
    const { supabase: db } = await requireStaff();
    const outcomes = await runImport(db, items);

    revalidateTag(TAGS.products);
    revalidateTag(TAGS.collections);
    revalidatePath('/', 'layout');
    revalidatePath('/admin/products');
    return outcomes;
  });
}
