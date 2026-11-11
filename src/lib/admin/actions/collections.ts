'use server';

import { action, requireStaff } from '@/lib/admin/auth';
import { slugify } from '@/lib/admin/format';
import type { CollectionInput } from '@/lib/admin/types';
import { TAGS } from '@/lib/constants';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function saveCollection(input: CollectionInput) {
  return action(async () => {
    const { supabase: db } = await requireStaff();
    const title = input.title.trim();
    if (!title) throw new Error('Title can’t be blank.');

    const root = slugify(input.handle || title) || 'collection';
    let handle = root;
    for (let i = 2; ; i++) {
      let q = db.from('collections').select('id').eq('handle', handle);
      if (input.id) q = q.neq('id', input.id);
      const { data } = await q.maybeSingle();
      if (!data) break;
      handle = `${root}-${i}`;
    }

    const row = {
      title,
      handle,
      description: input.description.trim(),
      image_url: input.image_url,
      published: input.published,
      sort_order: Math.trunc(Number(input.sort_order) || 0),
      seo_title: input.seo_title.trim() || null,
      seo_description: input.seo_description.trim() || null
    };

    let id = input.id;
    if (id) {
      const { error } = await db.from('collections').update(row).eq('id', id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await db.from('collections').insert(row).select('id').single();
      if (error) throw new Error(error.message);
      id = data.id as string;
    }

    // Replace membership in the given order.
    await db.from('collection_products').delete().eq('collection_id', id);
    if (input.product_ids.length) {
      const { error } = await db
        .from('collection_products')
        .insert(input.product_ids.map((product_id, position) => ({ collection_id: id, product_id, position })));
      if (error) throw new Error(error.message);
    }

    revalidateTag(TAGS.collections);
    revalidatePath('/', 'layout');
    return { id: id! };
  });
}

export async function deleteCollection(id: string) {
  return action(async () => {
    const { supabase: db } = await requireStaff();
    const { error } = await db.from('collections').delete().eq('id', id);
    if (error) throw new Error(error.message);
    revalidateTag(TAGS.collections);
    revalidatePath('/', 'layout');
  });
}
