'use server';

import { action, requireStaff } from '@/lib/admin/auth';
import type { DiscountInput } from '@/lib/admin/types';
import { revalidatePath } from 'next/cache';

const optNum = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

export async function saveDiscount(input: DiscountInput) {
  return action(async () => {
    const { supabase: db } = await requireStaff();
    const code = input.code.trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new Error('Codes use 3–40 letters, numbers, dashes or underscores.');

    const value = input.type === 'free_shipping' ? 0 : Number(input.value.replace(',', '.'));
    if (input.type !== 'free_shipping' && !(value > 0)) throw new Error('Enter a discount value.');
    if (input.type === 'percentage' && value > 100) throw new Error('A percentage can’t be more than 100.');

    const min = optNum(input.min_subtotal);
    const limit = optNum(input.usage_limit);
    const starts = input.starts_at ? new Date(input.starts_at) : new Date();
    const ends = input.ends_at ? new Date(input.ends_at) : null;
    if (ends && ends <= starts) throw new Error('The end date must be after the start date.');

    const row = {
      code,
      type: input.type,
      value,
      min_subtotal: min,
      usage_limit: limit === null ? null : Math.trunc(limit),
      starts_at: starts.toISOString(),
      ends_at: ends?.toISOString() ?? null,
      active: input.active,
      first_order_only: !!input.first_order_only,
      once_per_customer: !!input.once_per_customer
    };

    let id = input.id;
    if (id) {
      const { error } = await db.from('discounts').update(row).eq('id', id);
      if (error) throw new Error(error.code === '23505' ? 'That code already exists.' : error.message);
    } else {
      const { data, error } = await db.from('discounts').insert(row).select('id').single();
      if (error) throw new Error(error.code === '23505' ? 'That code already exists.' : error.message);
      id = data.id as string;
    }
    revalidatePath('/admin/discounts');
    return { id: id! };
  });
}

export async function deleteDiscount(id: string) {
  return action(async () => {
    const { supabase: db } = await requireStaff();
    const { error } = await db.from('discounts').delete().eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/admin/discounts');
  });
}
