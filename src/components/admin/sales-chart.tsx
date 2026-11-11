'use client';

import { useState } from 'react';

type Point = { date: string; label: string; value: number; orders: number };

/**
 * Single-series daily sales bars (one hue, no legend — the card title names it).
 * Thin bars with rounded tops anchored to the baseline, recessive grid,
 * per-bar hover tooltip with a hit target wider than the mark.
 */
export function SalesChart({ data, currency }: { data: Point[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 200;
  const pad = { top: 12, right: 8, bottom: 22, left: 44 };
  const max = Math.max(...data.map((d) => d.value), 0);
  // With no sales yet, show a sensible empty axis instead of $0/$1/$1.
  const nice = (() => {
    if (max <= 0) return 100;
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.max(Math.ceil(max / p) * p, 10);
  })();
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const step = innerW / data.length;
  const barW = Math.max(2, Math.min(14, step - 2));
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency, maximumFractionDigits: 0, currencyDisplay: 'narrowSymbol' }).format(n);
  const ticks = [0, nice / 2, nice];
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Sales per day, last 30 days">
        {ticks.map((t) => {
          const y = pad.top + innerH - (t / nice) * innerH;
          return (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke="#e3e3e3" strokeWidth={1} />
              <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#616161">
                {fmt(t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = pad.left + i * step + (step - barW) / 2;
          const bh = (d.value / nice) * innerH;
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
              {(i === data.length - 1 || (i % 7 === 0 && data.length - 1 - i >= 4)) && (
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
          <div className="text-admin-text">{fmt(h.value)}</div>
          <div className="text-admin-subdued">
            {h.orders} order{h.orders === 1 ? '' : 's'}
          </div>
        </div>
      )}
    </div>
  );
}
