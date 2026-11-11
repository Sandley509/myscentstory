import { SettingsForm } from '@/components/admin/settings-form';
import { requireStaffPage } from '@/lib/admin/auth';
import type { StoreSettingsRow } from '@/lib/commerce/db';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const { supabase, staff, user } = await requireStaffPage();
  const [{ data }, { data: team }] = await Promise.all([
    supabase.from('store_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('staff').select('user_id, email, name, role').order('created_at')
  ]);
  const s = (data ?? {}) as Partial<StoreSettingsRow>;

  const health = [
    {
      label: 'Supabase service role key',
      ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
      hint: 'Set SUPABASE_SERVICE_ROLE_KEY — needed for carts, checkout and uploads.'
    },
    { label: 'Stripe secret key', ok: Boolean(process.env.STRIPE_SECRET_KEY), hint: 'Set STRIPE_SECRET_KEY to accept payments.' },
    {
      label: 'Stripe webhook secret',
      ok: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      hint: 'Set STRIPE_WEBHOOK_SECRET — without it paid checkouts never become orders.'
    },
    { label: 'Public site URL', ok: Boolean(process.env.NEXT_PUBLIC_SITE_URL), hint: 'Set NEXT_PUBLIC_SITE_URL to your live domain.' },
    {
      label: 'Order emails (Resend)',
      ok: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
      hint: 'Set RESEND_API_KEY and EMAIL_FROM so customers get order confirmations and shipping updates.'
    }
  ];

  return (
    <SettingsForm
      isOwner={staff.role === 'owner'}
      currentUserId={user.id}
      staff={(team ?? []) as { user_id: string; email: string; name: string | null; role: 'owner' | 'staff' }[]}
      health={health}
      initial={{
        store_name: s.store_name ?? '',
        contact_email: s.contact_email ?? '',
        phone: s.phone ?? '',
        currency: s.currency === 'USD' ? 'USD' : 'CAD',
        address: { line1: '', line2: '', city: '', state: '', postal_code: '', country: 'CA', ...(s.address ?? {}) },
        shipping_flat_rate: s.shipping_flat_rate === undefined ? '0' : String(Number(s.shipping_flat_rate)),
        free_shipping_threshold:
          s.free_shipping_threshold === null || s.free_shipping_threshold === undefined ? '' : String(Number(s.free_shipping_threshold)),
        stripe_automatic_tax: s.stripe_automatic_tax ?? false,
        allowed_countries: s.allowed_countries ?? ['CA', 'US']
      }}
    />
  );
}
