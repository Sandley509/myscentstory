/**
 * Storefront content that staff edit in /admin → Online store.
 *
 * Stored as one JSON document in `site_content`. `normalizeContent` fills every
 * gap with the defaults below and clamps lengths, so a missing table, an empty
 * row or a half-saved document can never break the storefront.
 */
import { SITE } from './site';

export type SiteContent = {
  /** Top menu. Empty = the automatic menu (Best sellers, New, your collections, All perfumes). */
  nav: { items: NavLinkContent[] };
  announcement: {
    enabled: boolean;
    /** Empty = automatic ("Free shipping on orders over $X", or the tagline). */
    text: string;
    link: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    text: string;
    buttonLabel: string;
    buttonLink: string;
    /** Banner photo. Empty = the built-in bottle artwork. */
    imageUrl: string;
  };
  promo: {
    enabled: boolean;
    title: string;
    text: string;
    buttonLabel: string;
    buttonLink: string;
  };
  featured: { title: string };
  families: {
    enabled: boolean;
    title: string;
    text: string;
    imageUrl: string;
  };
  categories: {
    title: string;
    /** Up to 4 tiles; the first one is the large tile. Empty = the first 4 collections. */
    tiles: CategoryTileContent[];
  };
  /** First-visit popup offering a discount code. */
  welcome: {
    enabled: boolean;
    title: string;
    text: string;
    /** Must exist in /admin → Discounts (WELCOME10 is created by migration 0004). */
    code: string;
  };
  social: { instagram: string; facebook: string; tiktok: string };
  seo: { homeTitle: string; homeDescription: string };
};

export type NavLinkContent = {
  /** Editor-only key that keeps edits attached to the right row; never stored. */
  id?: string;
  label: string;
  link: string;
};

export const MAX_NAV_LINKS = 8;

export type CategoryTileContent = {
  /** Editor-only key that keeps an upload attached to its tile; never stored. */
  id?: string;
  /** Collection handle, or "all" for the full catalogue. */
  collection: string;
  /** Empty = the collection's name. */
  label: string;
  /** Empty = the collection's image, then the bottle artwork. */
  imageUrl: string;
};

export const MAX_CATEGORY_TILES = 4;

export const DEFAULT_CONTENT: SiteContent = {
  nav: { items: [] },
  announcement: { enabled: true, text: '', link: '' },
  hero: {
    eyebrow: SITE.tagline,
    title: 'Find your signature scent',
    text: 'Perfumes for her and for him, from fresh citrus to deep amber and oud.',
    buttonLabel: 'Shop now',
    buttonLink: '/collections/all',
    imageUrl: '/banners/hero.jpg'
  },
  promo: {
    enabled: true,
    title: 'The gift of scent',
    text: 'Perfume sets, boxed and ready to give.',
    buttonLabel: 'Shop gift sets',
    buttonLink: '/collections/gift-sets'
  },
  featured: { title: 'Currently hot & loved' },
  families: {
    enabled: true,
    title: 'Shop by scent family',
    text: 'Know what you like? Start from the family and discover something new.',
    imageUrl: ''
  },
  categories: { title: 'Discover by category', tiles: [] },
  welcome: {
    enabled: true,
    title: '10% off your first order',
    text: 'Join the MyScentStory list for new arrivals and exclusive offers, and get 10% off your first order.',
    code: 'WELCOME10'
  },
  social: { ...SITE.social },
  seo: { homeTitle: '', homeDescription: '' }
};

const text = (v: unknown, fallback: string, max: number) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : fallback;

const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/** Internal path ("/collections/all") or a full https URL; anything else is dropped. */
export const cleanLink = (v: unknown, fallback = ''): string => {
  if (typeof v !== 'string') return fallback;
  const s = v.trim().slice(0, 500);
  if (!s) return '';
  return /^\/(?!\/)/.test(s) || /^https:\/\//i.test(s) ? s : fallback;
};

const cleanUrl = (v: unknown): string => {
  if (typeof v !== 'string') return '';
  const s = v.trim().slice(0, 1000);
  return /^https:\/\//i.test(s) ? s : '';
};

/** Your own Supabase storage, which is plain http when Supabase runs on your computer. */
const OWN_STORAGE = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');

/** An uploaded photo (https or your own storage) or a file shipped in /public (e.g. /banners/hero.jpg). */
const cleanImage = (v: unknown, fallback: string): string => {
  if (typeof v !== 'string') return fallback;
  const s = v.trim().slice(0, 1000);
  if (OWN_STORAGE && s.startsWith(`${OWN_STORAGE}/storage/v1/`)) return s;
  return !s || /^\/(?!\/)/.test(s) || /^https:\/\//i.test(s) ? s : fallback;
};

type Loose = Record<string, Record<string, unknown> | undefined>;

export function normalizeContent(raw: unknown): SiteContent {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Loose;
  const d = DEFAULT_CONTENT;
  return {
    nav: {
      items: (Array.isArray(r.nav?.items) ? (r.nav.items as unknown[]) : [])
        .map((t) => (t && typeof t === 'object' ? (t as Record<string, unknown>) : {}))
        .map((t) => ({ label: text(t.label, '', 30), link: cleanLink(t.link) }))
        .filter((t) => t.label && t.link)
        .slice(0, MAX_NAV_LINKS)
    },
    announcement: {
      enabled: bool(r.announcement?.enabled, d.announcement.enabled),
      text: text(r.announcement?.text, d.announcement.text, 120),
      link: cleanLink(r.announcement?.link)
    },
    hero: {
      eyebrow: text(r.hero?.eyebrow, d.hero.eyebrow, 60),
      title: text(r.hero?.title, d.hero.title, 80) || d.hero.title,
      text: text(r.hero?.text, d.hero.text, 200),
      buttonLabel: text(r.hero?.buttonLabel, d.hero.buttonLabel, 30),
      buttonLink: cleanLink(r.hero?.buttonLink, d.hero.buttonLink) || d.hero.buttonLink,
      imageUrl: cleanImage(r.hero?.imageUrl, d.hero.imageUrl)
    },
    promo: {
      enabled: bool(r.promo?.enabled, d.promo.enabled),
      title: text(r.promo?.title, d.promo.title, 80),
      text: text(r.promo?.text, d.promo.text, 160),
      buttonLabel: text(r.promo?.buttonLabel, d.promo.buttonLabel, 30),
      buttonLink: cleanLink(r.promo?.buttonLink, d.promo.buttonLink) || d.promo.buttonLink
    },
    featured: { title: text(r.featured?.title, d.featured.title, 60) || d.featured.title },
    families: {
      enabled: bool(r.families?.enabled, d.families.enabled),
      title: text(r.families?.title, d.families.title, 60) || d.families.title,
      text: text(r.families?.text, d.families.text, 200),
      imageUrl: cleanImage(r.families?.imageUrl, d.families.imageUrl)
    },
    categories: {
      title: text(r.categories?.title, d.categories.title, 60) || d.categories.title,
      tiles: (Array.isArray(r.categories?.tiles) ? (r.categories.tiles as unknown[]) : [])
        .map((t) => (t && typeof t === 'object' ? (t as Record<string, unknown>) : {}))
        .map((t) => ({
          collection: typeof t.collection === 'string' ? t.collection.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 100) : '',
          label: text(t.label, '', 40),
          imageUrl: cleanImage(t.imageUrl, '')
        }))
        .filter((t) => t.collection)
        .slice(0, MAX_CATEGORY_TILES)
    },
    welcome: {
      enabled: bool(r.welcome?.enabled, d.welcome.enabled),
      title: text(r.welcome?.title, d.welcome.title, 60) || d.welcome.title,
      text: text(r.welcome?.text, d.welcome.text, 200),
      code: (typeof r.welcome?.code === 'string' ? r.welcome.code : d.welcome.code).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40)
    },
    social: {
      instagram: cleanUrl(r.social?.instagram ?? d.social.instagram),
      facebook: cleanUrl(r.social?.facebook ?? d.social.facebook),
      tiktok: cleanUrl(r.social?.tiktok ?? d.social.tiktok)
    },
    seo: {
      homeTitle: text(r.seo?.homeTitle, '', 70),
      homeDescription: text(r.seo?.homeDescription, '', 160)
    }
  };
}
