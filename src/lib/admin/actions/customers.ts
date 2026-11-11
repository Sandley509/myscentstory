'use server';

import { action, requireStaff } from '@/lib/admin/auth';
import type { CustomerInput } from '@/lib/admin/types';
import { revalidatePath } from 'next/cache';

export async function saveCustomer(input: CustomerInput) {
  return action(async () => {
    const { supabase: db } = await requireStaff();
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');

    const row = {
      email,
      first_name: input.first_name.trim() || null,
      last_name: input.last_name.trim() || null,
      phone: input.phone.trim() || null,
      accepts_marketing: input.accepts_marketing,
      note: input.note.trim() || null,
      tags: [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))]
    };

    let id = input.id;
    if (id) {
      const { error } = await db.from('customers').update(row).eq('id', id);
      if (error) throw new Error(error.code === '23505' ? 'Another customer already uses this email.' : error.message);
    } else {
      const { data, error } = await db.from('customers').insert(row).select('id').single();
      if (error) throw new Error(error.code === '23505' ? 'A customer with this email already exists.' : error.message);
      id = data.id as string;
    }
    revalidatePath('/admin/customers');
    return { id: id! };
  });
}

export async function deleteCustomer(id: string) {
  return action(async () => {
    const { supabase: db } = await requireStaff();
    const { error } = await db.from('customers').delete().eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/admin/customers');
  });
}
