import { LiveTile, VisitsChart } from '@/components/admin/analytics-client';
import { Banner, Card, Page } from '@/components/admin/ui';
import { requireStaffPage } from '@/lib/admin/auth';
import { formatMoney } from '@/lib/admin/format';
import { ANALYTICS_RANGES, isMissingAnalytics, pageLabel, type AnalyticsSummary } from '@/lib/analytics';
import { countryName } from '@/lib/countries';
import { SITE } from '@/lib/site';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Analytics' };

const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '–');

function Ranked({ rows, empty }: { rows: { key: string; label: string; value: number; href?: string }[]; empty: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (!rows.length) return <p className="text-admin-subdued">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex justify-between gap-3">
            {r.href ? (
              <a href={r.href} target="_blank" rel="noreferrer" className="truncate text-admin-link hover:underline">
                {r.label}
              </a>
            ) : (
              <span className="truncate">{r.label}</span>
            )}
            <span className="shrink-0 tabular-nums">{r.value.toLocaleString('en-CA')}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-[#f1f1f1]">
            <div className="h-1.5 rounded-full bg-[#005bd3]" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeKey } = await searchParams;
  const range = ANALYTICS_RANGES.find((r) => r.key === rangeKey) ?? ANALYTICS_RANGES[2];
  const { supabase } = await requireStaffPage();
  const [{ data, error }, { data: settings }] = await Promise.all([
    supabase.rpc('analytics_summary', { p_days: range.days, p_tz: SITE.timeZone }),
    supabase.from('store_settings').select('currency').eq('id', 1).maybeSingle()
  ]);
  const currency = settings?.currency ?? 'CAD';
  const s = data as AnalyticsSummary | null;

  const tabs = (
    <div className="flex flex-wrap gap-1" role="tablist" aria-label="Date range">
      {ANALYTICS_RANGES.map((r) => (
        <Link
          key={r.key}
          href={`/admin/analytics?range=${r.key}`}
          role="tab"
          aria-selected={r.key === range.key}
          className={`rounded-lg px-3 py-1.5 font-semibold ${r.key === range.key ? 'bg-white shadow-sm ring-1 ring-admin-border' : 'text-admin-subdued hover:bg-black/5'}`}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );

  if (error || !s) {
    return (
      <Page title="Analytics">
        <Banner tone={error && isMissingAnalytics(error.message) ? 'warning' : 'critical'} title="Analytics isn’t available">
          {error && isMissingAnalytics(error.message) ? (
            <>
              Run <code>supabase/migrations/0005_analytics_abandoned_carts.sql</code> in the Supabase SQL editor. Visits are
              counted from then on.
            </>
          ) : (
            error?.message
          )}
        </Banner>
      </Page>
    );
  }

  const chart = s.daily.map((d) => ({
    date: d.day,
    label: new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    sessions: d.sessions,
    visitors: d.visitors,
    pageViews: d.page_views
  }));

  const funnel = [
    { label: 'Sessions', value: s.sessions },
    { label: 'Added to cart', value: s.added_to_cart },
    { label: 'Reached checkout', value: s.reached_checkout },
    { label: 'Purchased', value: s.orders }
  ];

  return (
    <Page title="Analytics" subtitle="Visits to your store, counted in your own database with no outside trackers.">
      <div className="flex flex-col gap-4">
        {tabs}

        <div className="admin-card grid grid-cols-2 divide-admin-border md:grid-cols-6 md:divide-x">
          <LiveTile />
          {[
            { label: 'Sessions', value: s.sessions.toLocaleString('en-CA') },
            { label: 'Visitors', value: s.visitors.toLocaleString('en-CA') },
            { label: 'Page views', value: s.page_views.toLocaleString('en-CA') },
            { label: 'Conversion rate', value: pct(s.orders, s.sessions) },
            { label: 'Sales', value: formatMoney(s.sales, currency) }
          ].map((k) => (
            <div key={k.label} className="p-4">
              <div className="text-admin-subdued">{k.label}</div>
              <div className="mt-1 text-[20px] font-semibold">{k.value}</div>
            </div>
          ))}
        </div>

        <Card title={range.days === 1 ? 'Sessions today' : 'Sessions per day'}>
          <VisitsChart data={chart} />
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Conversion funnel">
            <ul className="flex flex-col gap-3">
              {funnel.map((f, i) => (
                <li key={f.label}>
                  <div className="flex justify-between gap-3">
                    <span>{f.label}</span>
                    <span className="tabular-nums">
                      {f.value.toLocaleString('en-CA')}
                      {i > 0 && <span className="ml-2 text-admin-subdued">{pct(f.value, s.sessions)}</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[#f1f1f1]">
                    <div className="h-2 rounded-full bg-[#005bd3]" style={{ width: s.sessions ? `${(f.value / s.sessions) * 100}%` : 0 }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] text-admin-subdued">
              Bounce rate {pct(s.bounced, s.sessions)} (visits that left after one page).{' '}
              <Link href="/admin/orders/abandoned" className="text-admin-link hover:underline">
                See abandoned carts
              </Link>
            </p>
          </Card>
          <Card title="Most viewed pages">
            <Ranked
              rows={s.top_pages.map((p) => ({ key: p.path, label: pageLabel(p.path), value: p.views, href: p.path }))}
              empty="No page views yet."
            />
          </Card>
          <Card title="Where visitors came from">
            <Ranked rows={s.referrers.map((r) => ({ key: r.name, label: r.name, value: r.sessions }))} empty="No visits yet." />
          </Card>
          <Card title="Sessions by country">
            <Ranked
              rows={s.countries.map((c) => ({ key: c.code, label: c.code === '??' ? 'Unknown' : countryName(c.code), value: c.sessions }))}
              empty="No visits yet."
            />
          </Card>
          <Card title="Sessions by device">
            <Ranked
              rows={s.devices.map((d) => ({ key: d.name, label: d.name[0]!.toUpperCase() + d.name.slice(1), value: d.sessions }))}
              empty="No visits yet."
            />
          </Card>
        </div>
      </div>
    </Page>
  );
}
