import 'server-only';

import { createSessionClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/env';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { cache } from 'react';

export type StaffMember = {
  user_id: string;
  email: string;
  name: string | null;
  role: 'owner' | 'staff';
};

export type StaffContext = {
  supabase: SupabaseClient;
  user: User;
  staff: StaffMember;
};

/** Current session + staff row (null when logged out or not staff). Cached per request. */
export const getStaffContext = cache(
  async (): Promise<{ supabase: SupabaseClient; user: User | null; staff: StaffMember | null }> => {
    if (!supabaseConfigured) redirect('/admin/login');
    const supabase = await createSessionClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { supabase, user: null, staff: null };

    const { data: staff } = await supabase
      .from('staff')
      .select('user_id, email, name, role')
      .eq('user_id', user.id)
      .maybeSingle();

    return { supabase, user, staff: (staff as StaffMember) ?? null };
  }
);

/** For pages: redirect to login when not signed in as staff. */
export async function requireStaffPage(): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx.user || !ctx.staff) redirect('/admin/login');
  return ctx as StaffContext;
}

/** For server actions: throws instead of redirecting. RLS enforces this too. */
export async function requireStaff(): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx.user || !ctx.staff) throw new Error('Not authorised.');
  return ctx as StaffContext;
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

/** Wraps a server action body so errors come back as `{ ok: false, error }`. */
export async function action<T = undefined>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data } as ActionResult<T>;
  } catch (e) {
    // Let Next.js redirects/not-found propagate.
    if (e && typeof e === 'object' && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_')) {
      throw e;
    }
    console.error('[admin action]', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Something went wrong.' };
  }
}
