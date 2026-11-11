import { AdminShell } from '@/components/admin/shell';
import { getStaffContext } from '@/lib/admin/auth';
import { signOut } from '@/lib/admin/actions/auth';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const { supabase, user, staff } = await getStaffContext();
  if (!user) redirect('/admin/login');

  if (!staff) {
    // Signed in, but not in the `staff` table.
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="admin-card max-w-md p-6 text-center">
          <h1 className="text-[16px] font-semibold">You don’t have access to this store</h1>
          <p className="mt-2 text-admin-subdued">
            {user.email} isn’t a staff account. Ask the store owner to add you in Settings → Users.
          </p>
          <form action={signOut} className="mt-4">
            <button className="admin-btn-secondary h-8 rounded-lg px-3 font-semibold">Log out</button>
          </form>
        </div>
      </div>
    );
  }

  const [{ data: settings }, { count: toFulfill }] = await Promise.all([
    supabase.from('store_settings').select('store_name').eq('id', 1).maybeSingle(),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .eq('financial_status', 'paid')
      .neq('fulfillment_status', 'fulfilled')
  ]);

  return (
    <AdminShell
      storeName={settings?.store_name ?? 'My store'}
      staffName={staff.name || staff.email}
      staffEmail={staff.email}
      ordersBadge={toFulfill ?? 0}
      signOut={signOut}
    >
      {children}
    </AdminShell>
  );
}
