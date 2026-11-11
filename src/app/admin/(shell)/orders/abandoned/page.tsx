import { AbandonedCartsTable } from '@/components/admin/abandoned-carts';
import { Banner, Card, Page } from '@/components/admin/ui';
import { ABANDONED_WINDOW_DAYS, loadAbandonedCarts } from '@/lib/admin/abandoned';
import { requireStaffPage } from '@/lib/admin/auth';
import { formatMoney } from '@/lib/admin/format';
import { emailConfigured } from '@/lib/email';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Abandoned carts' };

export default async function AbandonedCartsPage() {
  const { supabase } = await requireStaffPage();
  const since = new Date(Date.now() - ABANDONED_WINDOW_DAYS * 86_400_000).toISOString();
  const [{ carts, error }, { data: settings }, { count: recovered }] = await Promise.all([
    loadAbandonedCarts(supabase),
    supabase.from('store_settings').select('currency').eq('id', 1).maybeSingle(),
    supabase
      .from('carts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .not('recovery_email_sent_at', 'is', null)
      .gt('recovery_email_sent_at', since)
  ]);
  const currency = settings?.currency ?? 'CAD';
  const missingMigration = !!error && /activity_at|recovery_email_sent_at|column/.test(error);
  const withEmail = carts.filter((c) => c.email).length;
  const value = carts.reduce((s, c) => s + c.value, 0);

  return (
    <Page
      title="Abandoned carts"
      subtitle={`Carts with items that weren’t bought, left for over an hour in the last ${ABANDONED_WINDOW_DAYS} days.`}
      backHref="/admin/orders"
    >
      <div className="flex flex-col gap-4">
        {error && (
          <Banner tone={missingMigration ? 'warning' : 'critical'} title="Abandoned carts aren’t available">
            {missingMigration ? (
              <>
                Run <code>supabase/migrations/0005_analytics_abandoned_carts.sql</code> in the Supabase SQL editor.
              </>
            ) : (
              error
            )}
          </Banner>
        )}
        {!emailConfigured() && (
          <Banner tone="info" title="Reminder emails need Resend">
            Set <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> to send reminders from this page.
          </Banner>
        )}

        <div className="admin-card grid grid-cols-2 divide-admin-border md:grid-cols-4 md:divide-x">
          {[
            { label: 'Abandoned carts', value: String(carts.length) },
            { label: 'Value left behind', value: formatMoney(value, currency) },
            { label: 'With an email', value: String(withEmail) },
            { label: 'Recovered after a reminder', value: String(recovered ?? 0) }
          ].map((k) => (
            <div key={k.label} className="p-4">
              <div className="text-admin-subdued">{k.label}</div>
              <div className="mt-1 text-[20px] font-semibold">{k.value}</div>
            </div>
          ))}
        </div>

        <Card flush>
          <AbandonedCartsTable carts={carts} currency={currency} canEmail={emailConfigured()} />
        </Card>

        <p className="text-[12px] text-admin-subdued">
          We get the email when the shopper types it at Stripe checkout, in the welcome offer, or with a first-order discount.
          Reminders are only sent when you click Send. Canadian anti-spam law (CASL) allows a reminder to someone who started an
          order with you; every reminder includes how to opt out.
        </p>
      </div>
    </Page>
  );
}
