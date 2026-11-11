import type { Address, FinancialStatus, FulfillmentStatus, OrderStatus } from '@/lib/commerce/db';
import type { BadgeTone } from '@/components/admin/ui';

export function formatMoney(amount: number | string | null | undefined, currency = 'CAD'): string {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol'
  }).format(Number.isFinite(n) ? n : 0);
}

const TZ = 'America/Toronto';

/** "Today at 3:04 p.m.", "Yesterday at …", "Sep 18 at …", "Sep 18, 2025". */
export function formatDate(iso: string | null | undefined, opts: { time?: boolean } = { time: true }): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const dayKey = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: TZ });
  const time = d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const yesterday = new Date(now.getTime() - 86_400_000);

  let day: string;
  if (dayKey(d) === dayKey(now)) day = 'Today';
  else if (dayKey(d) === dayKey(yesterday)) day = 'Yesterday';
  else
    day = d.toLocaleDateString('en-US', {
      timeZone: TZ,
      month: 'short',
      day: 'numeric',
      ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
    });
  return opts.time ? `${day} at ${time}` : day;
}

export function formatAddress(a: Address | null | undefined): string[] {
  if (!a) return [];
  return [
    a.name,
    a.line1,
    a.line2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(' '),
    a.country === 'CA' ? 'Canada' : a.country === 'US' ? 'United States' : a.country,
    a.phone
  ].filter((x): x is string => !!x && x.trim().length > 0);
}

export const financialBadge: Record<FinancialStatus, { label: string; tone: BadgeTone; dot: 'incomplete' | 'partial' | 'complete' }> = {
  pending: { label: 'Payment pending', tone: 'warning', dot: 'incomplete' },
  paid: { label: 'Paid', tone: 'default', dot: 'complete' },
  partially_refunded: { label: 'Partially refunded', tone: 'default', dot: 'partial' },
  refunded: { label: 'Refunded', tone: 'default', dot: 'complete' },
  voided: { label: 'Voided', tone: 'default', dot: 'complete' }
};

export const fulfillmentBadge: Record<FulfillmentStatus, { label: string; tone: BadgeTone; dot: 'incomplete' | 'partial' | 'complete' }> = {
  unfulfilled: { label: 'Unfulfilled', tone: 'warning', dot: 'incomplete' },
  partial: { label: 'Partially fulfilled', tone: 'attention', dot: 'partial' },
  fulfilled: { label: 'Fulfilled', tone: 'default', dot: 'complete' }
};

export const orderStatusBadge: Record<OrderStatus, { label: string; tone: BadgeTone } | null> = {
  open: null,
  archived: { label: 'Archived', tone: 'default' },
  cancelled: { label: 'Canceled', tone: 'default' }
};

export function customerName(c: { first_name?: string | null; last_name?: string | null; email?: string | null } | null | undefined) {
  if (!c) return 'No customer';
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ');
  return name || c.email || 'Unnamed customer';
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
