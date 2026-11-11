/** Shapes returned by the analytics SQL functions (migration 0005). */
export type AnalyticsSummary = {
  sessions: number;
  visitors: number;
  page_views: number;
  bounced: number;
  added_to_cart: number;
  reached_checkout: number;
  orders: number;
  sales: number;
  daily: { day: string; sessions: number; visitors: number; page_views: number }[];
  top_pages: { path: string; views: number; visitors: number }[];
  referrers: { name: string; sessions: number }[];
  countries: { code: string; sessions: number }[];
  devices: { name: string; sessions: number }[];
};

export type LiveSession = {
  path: string;
  country: string | null;
  device: string | null;
  referrer: string | null;
  page_views: number;
  last_seen: string;
  started_at: string;
  has_cart: boolean;
};

export type LiveView = {
  visitors: number;
  in_cart: number;
  pages: { path: string; visitors: number }[];
  countries: { code: string; visitors: number }[];
  sessions: LiveSession[];
};

export const ANALYTICS_RANGES = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 }
] as const;

export const isMissingAnalytics = (message: string) =>
  /analytics_|page_views|visitor_sessions/.test(message) && /(not exist|schema cache|find the function|Could not find)/i.test(message);

/** A friendlier name for a store path ("/" → "Home page"). */
export function pageLabel(path: string): string {
  const p = path.split('?')[0]!;
  if (p === '/') return 'Home page';
  if (p === '/collections/all') return 'All perfumes';
  if (p.startsWith('/search')) return 'Search';
  if (p === '/track') return 'Order tracking';
  if (p.startsWith('/checkout')) return 'Checkout';
  return p;
}
