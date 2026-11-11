/**
 * Brand + policy settings for the MyScentStory storefront.
 *
 * Everything customer-facing that isn't a product lives here, so it can be
 * changed in one place. Store name, currency, shipping rate and delivery
 * countries come from /admin → Settings instead.
 */

/** Public address of the store. A missing scheme means https; http is kept for local development. */
export const siteUrl = (() => {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').trim();
  return (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).replace(/\/+$/, '');
})();

export const SITE = {
  name: 'MyScentStory',
  legalName: 'MyScentStory Perfumes',
  tagline: 'Every scent tells a story',
  /** Default meta description (home page, social shares). Keep it under 160 characters. */
  description:
    'Shop perfumes for women and men at MyScentStory. Eau de parfum, eau de toilette and gift sets, shipped across Canada and the United States.',
  locale: 'en_CA',
  /** Dates and times shown to customers (order pages, emails). */
  timeZone: 'America/Toronto',
  language: 'en-CA',

  /** Starting values only: edit these in /admin → Online store. */
  social: {
    instagram: '',
    facebook: '',
    tiktok: ''
  },

  /**
   * Returns policy. Shown on /pages/returns and sent to Google in the product
   * structured data — keep it identical to what you enter in Merchant Center.
   */
  returns: {
    days: 30,
    /** Days to report a damaged, leaking or wrong item. */
    damageReportDays: 7,
    /** Who pays for the return label: 'customer' or 'store'. */
    paidBy: 'customer' as 'customer' | 'store'
  },

  /** Customer-service address. /admin → Settings → Store contact email overrides it. */
  supportEmail: 'support@myscentstory.net',
  /** Shown on the contact page and in emails. */
  supportHours: 'Monday to Saturday, 9 a.m. to 6 p.m. Eastern Time',
  supportReplyTime: 'within 24 hours (one business day)',

  /**
   * Delivery estimate: handling + transit = 8 to 15 days worldwide.
   * Also sent to Google in the structured data. Rates live in /admin → Settings.
   */
  shipping: {
    handlingDays: [1, 2] as [number, number],
    transitDays: [7, 13] as [number, number],
    /** Main markets listed in the Google/Meta feed when shipping worldwide. */
    feedCountries: ['CA', 'US', 'GB', 'FR', 'DE', 'BE', 'CH', 'NL', 'IT', 'ES', 'IE', 'AU'] as string[]
  },

  /** Google's taxonomy id for "Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne". */
  googleProductCategory: '479'
};

/** Top navigation. Collections created in /admin are appended after these. */
export const PRIMARY_NAV = [
  { title: 'Best sellers', path: '/collections/all?sort=trending-desc' },
  { title: 'New', path: '/collections/all?sort=latest-desc' },
  { title: 'All perfumes', path: '/collections/all' }
];

export const POLICY_LINKS = [
  { title: 'Shipping', path: '/pages/shipping' },
  { title: 'Track your order', path: '/track' },
  { title: 'Returns & refunds', path: '/pages/returns' },
  { title: 'Privacy policy', path: '/pages/privacy' },
  { title: 'Terms of service', path: '/pages/terms' }
];

export const absoluteUrl = (path: string) =>
  /^https?:\/\//.test(path) ? path : `${siteUrl}${path.startsWith('/') ? '' : '/'}${path}`;
