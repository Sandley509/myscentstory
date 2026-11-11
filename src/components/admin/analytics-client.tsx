'use client';

import { Card } from '@/components/admin/ui';
import { getLiveView } from '@/lib/admin/actions/analytics';
import { pageLabel, type LiveView } from '@/lib/analytics';
import { countryName } from '@/lib/countries';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Point = { date: string; label: string; sessions: number; visitors: number; pageViews: number };

/** Daily sessions as bars, with visitors and page views in the tooltip. */
export function VisitsChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 200;
  const pad = { top: 12, right: 8, bottom: 22, left: 36 };
  const max = Math.max(...data.map((d) => d.sessions), 0);
  const nice = (() => {
    if (max <= 4) return 4;
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / p) * p;
  })();
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const step = innerW / Math.max(data.length, 1);
  const barW = Math.max(2, Math.min(28, step - 2));
  const h = hover !== null ? data[hover] : null;
  const every = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Sessions per day">
        {[0, nice / 2, nice].map((t) => {
          const y = pad.top + innerH - (t / nice) * innerH;
          return (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke="#e3e3e3" strokeWidth={1} />
              <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#616161">
                {t}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = pad.left + i * step + (step - barW) / 2;
          const bh = (d.sessions / nice) * innerH;
          const y = pad.top + innerH - bh;
          const r = Math.min(4, barW / 2, bh);
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.left + i * step} y={pad.top} width={step} height={innerH} fill="transparent" />
              {bh > 0 && (
                <path
                  d={`M${x},${y + bh} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + bh} Z`}
                  fill={hover === i ? '#004299' : '#005bd3'}
                />
              )}
              {(i === data.length - 1 || (i % every === 0 && data.length - 1 - i >= every / 2)) && (
                <text x={pad.left + i * step + step / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#616161">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-white px-3 py-2 text-[12px] shadow-lg ring-1 ring-black/10"
          style={{ left: `${((pad.left + hover * step + step / 2) / W) * 100}%` }}
        >
          <div className="font-semibold text-admin-text">{h.label}</div>
          <div className="text-admin-text">
            {h.sessions} session{h.sessions === 1 ? '' : 's'}
          </div>
          <div className="text-admin-subdued">
            {h.visitors} visitor{h.visitors === 1 ? '' : 's'} · {h.pageViews} page view{h.pageViews === 1 ? '' : 's'}
          </div>
        </div>
      )}
    </div>
  );
}

/** Polls the live view every 10 seconds while the tab is visible. */
function useLive(intervalMs = 10_000) {
  const [live, setLive] = useState<LiveView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      const res = await getLiveView();
      if (stopped) return;
      if (res.ok) {
        setLive(res.data);
        setError(null);
        setUpdatedAt(new Date());
      } else setError(res.error);
    };
    void load();
    const timer = window.setInterval(load, intervalMs);
    document.addEventListener('visibilitychange', load);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [intervalMs]);

  return { live, error, updatedAt };
}

const Pulse = () => (
  <span className="relative flex h-2.5 w-2.5" aria-hidden>
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#29845a] opacity-60" />
    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#29845a]" />
  </span>
);

/** "Online now" tile for the Analytics overview. */
export function LiveTile() {
  const { live, error } = useLive(15_000);
  return (
    <Link href="/admin/analytics/live" className="block p-4 hover:bg-admin-hover">
      <div className="flex items-center gap-2 text-admin-subdued">
        <Pulse /> Online now
      </div>
      <div className="mt-1 text-[20px] font-semibold">{error ? '–' : (live?.visitors ?? '…')}</div>
      <div className="text-[12px] text-admin-link">Open live view →</div>
    </Link>
  );
}

function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)} min ago`;
}

const flag = (code: string | null) =>
  code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐';

/** The full live view page: who is on the store right now. */
export function LiveViewPanel() {
  const { live, error, updatedAt } = useLive();

  if (error) {
    return (
      <Card>
        <p className="text-admin-critical">{error}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="admin-card grid grid-cols-2 md:grid-cols-3 md:divide-x divide-admin-border">
        <div className="p-4">
          <div className="flex items-center gap-2 text-admin-subdued">
            <Pulse /> Visitors right now
          </div>
          <div className="mt-1 text-[28px] font-semibold">{live?.visitors ?? '…'}</div>
        </div>
        <div className="p-4">
          <div className="text-admin-subdued">With items in their cart</div>
          <div className="mt-1 text-[28px] font-semibold">{live?.in_cart ?? '…'}</div>
        </div>
        <div className="col-span-2 p-4 text-[12px] text-admin-subdued md:col-span-1">
          Active in the last 5 minutes. Refreshes every 10 seconds
          {updatedAt ? ` · updated ${updatedAt.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}` : ''}.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Pages being viewed">
          {live?.pages.length ? (
            <ul className="flex flex-col gap-2">
              {live.pages.map((p) => (
                <li key={p.path} className="flex justify-between gap-3">
                  <a href={p.path} target="_blank" rel="noreferrer" className="truncate text-admin-link hover:underline">
                    {pageLabel(p.path)}
                  </a>
                  <span className="shrink-0 tabular-nums">{p.visitors}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-admin-subdued">Nobody on the store right now.</p>
          )}
        </Card>
        <Card title="Where they are">
          {live?.countries.length ? (
            <ul className="flex flex-col gap-2">
              {live.countries.map((c) => (
                <li key={c.code} className="flex justify-between gap-3">
                  <span>
                    {flag(c.code)} {c.code === '??' ? 'Unknown' : countryName(c.code)}
                  </span>
                  <span className="tabular-nums">{c.visitors}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-admin-subdued">–</p>
          )}
        </Card>
      </div>

      <Card title="Active visits" flush>
        {live?.sessions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-y border-admin-border bg-[#f7f7f7] text-[12px] text-admin-subdued">
                <tr>
                  <th className="px-4 py-2 font-medium">Page</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="px-4 py-2 font-medium">Device</th>
                  <th className="px-4 py-2 font-medium">Came from</th>
                  <th className="px-4 py-2 font-medium">Pages</th>
                  <th className="px-4 py-2 font-medium">Cart</th>
                  <th className="px-4 py-2 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {live.sessions.map((s, i) => (
                  <tr key={i} className="border-b border-admin-border last:border-b-0">
                    <td className="max-w-[260px] truncate px-4 py-2">{pageLabel(s.path)}</td>
                    <td className="px-4 py-2">
                      {flag(s.country)} {s.country ? countryName(s.country) : 'Unknown'}
                    </td>
                    <td className="px-4 py-2 capitalize">{s.device ?? '–'}</td>
                    <td className="px-4 py-2">{s.referrer ?? 'Direct'}</td>
                    <td className="px-4 py-2 tabular-nums">{s.page_views}</td>
                    <td className="px-4 py-2">{s.has_cart ? '🛒' : ''}</td>
                    <td className="px-4 py-2 text-admin-subdued">{ago(s.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 pb-4 text-admin-subdued">{live ? 'No active visits.' : 'Loading…'}</p>
        )}
      </Card>
    </div>
  );
}
