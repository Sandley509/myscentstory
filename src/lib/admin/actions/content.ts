'use server';

import { action, requireStaff } from '@/lib/admin/auth';
import { normalizeContent, type SiteContent } from '@/lib/content';
import { revalidatePath } from 'next/cache';

/** Saves the storefront content and refreshes every cached storefront page. */
export async function saveContent(input: SiteContent) {
  return action(async () => {
    const { supabase: db } = await requireStaff();
    // Never trust the browser: re-clean lengths and links on the server.
    const content = normalizeContent(input);
    const { error } = await db.from('site_content').upsert({ id: 1, content });
    if (error) {
      throw new Error(
        /site_content/.test(error.message) && /(not exist|schema cache|find the table)/i.test(error.message)
          ? 'The content table is missing. Run supabase/migrations/0003_site_content.sql in Supabase, then save again.'
          : error.message
      );
    }
    revalidatePath('/', 'layout');
    revalidatePath('/admin/content');
    return content;
  });
}
