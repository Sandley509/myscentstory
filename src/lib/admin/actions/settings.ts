'use server';

import { action, requireStaff } from '@/lib/admin/auth';
import type { Address } from '@/lib/commerce/db';
import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type SettingsInput = {
  store_name: string;
  contact_email: string;
  phone: string;
  currency: 'CAD' | 'USD';
  address: Address;
  shipping_flat_rate: string;
  free_shipping_threshold: string;
  stripe_automatic_tax: boolean;
  allowed_countries: string[];
};

export async function saveSettings(input: SettingsInput) {
  return action(async () => {
    const { supabase: db } = await requireStaff();
    if (!input.store_name.trim()) throw new Error('Store name can’t be blank.');
    const rate = Number(input.shipping_flat_rate || 0);
    if (!(rate >= 0)) throw new Error('Shipping rate must be 0 or more.');
    const threshold = input.free_shipping_threshold.trim() === '' ? null : Number(input.free_shipping_threshold);
    const countries = input.allowed_countries.includes('WORLD')
      ? ['WORLD']
      : input.allowed_countries.filter((c) => /^[A-Z]{2}$/.test(c));
    if (!countries.length) throw new Error('Choose at least one country you deliver to.');

    const { error } = await db
      .from('store_settings')
      .update({
        store_name: input.store_name.trim(),
        contact_email: input.contact_email.trim() || null,
        phone: input.phone.trim() || null,
        currency: input.currency === 'USD' ? 'USD' : 'CAD',
        address: input.address,
        shipping_flat_rate: Math.round(rate * 100) / 100,
        free_shipping_threshold: threshold,
        stripe_automatic_tax: input.stripe_automatic_tax,
        allowed_countries: countries
      })
      .eq('id', 1);
    if (error) throw new Error(error.message);
    revalidatePath('/', 'layout');
  });
}

/** Owner only: create a staff login (email + temporary password). */
export async function addStaff(input: { email: string; name: string; password: string; role: 'owner' | 'staff' }) {
  return action(async () => {
    const { staff } = await requireStaff();
    if (staff.role !== 'owner') throw new Error('Only the store owner can add staff.');
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email.');
    if (input.password.length < 8) throw new Error('Temporary password must be at least 8 characters.');

    const admin = createServiceClient();
    let userId: string | null = null;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true
    });
    if (error) {
      // Already registered → look the user up and just grant access.
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
      if (!userId) throw new Error(error.message);
    } else {
      userId = created.user.id;
    }

    const { error: insErr } = await admin
      .from('staff')
      .upsert({ user_id: userId, email, name: input.name.trim() || null, role: input.role });
    if (insErr) throw new Error(insErr.message);
    revalidatePath('/admin/settings');
  });
}

export async function removeStaff(userId: string) {
  return action(async () => {
    const { staff, user } = await requireStaff();
    if (staff.role !== 'owner') throw new Error('Only the store owner can remove staff.');
    if (userId === user.id) throw new Error('You can’t remove yourself.');
    const { error } = await createServiceClient().from('staff').delete().eq('user_id', userId);
    if (error) throw new Error(error.message);
    revalidatePath('/admin/settings');
  });
}

export async function updateAccount(input: { name: string; password: string }) {
  return action(async () => {
    const { supabase, user } = await requireStaff();
    if (input.password) {
      if (input.password.length < 8) throw new Error('Password must be at least 8 characters.');
      const { error } = await supabase.auth.updateUser({ password: input.password });
      if (error) throw new Error(error.message);
    }
    await createServiceClient().from('staff').update({ name: input.name.trim() || null }).eq('user_id', user.id);
    revalidatePath('/admin', 'layout');
  });
}
