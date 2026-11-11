/**
 * Demo catalogue.
 *
 * Used automatically while Supabase isn't configured, so `npm run dev` shows a
 * working perfume store before the backend exists. The houses and perfumes
 * below are invented placeholders — once the Supabase env vars are set this
 * file is never read again.
 */
import type { Cart, Collection, Gender, Product } from './types';

const CURRENCY = 'CAD';
const money = (amount: number) => ({ amount: amount.toFixed(2), currencyCode: CURRENCY });

type Demo = {
  handle: string;
  title: string;
  house: string;
  gender: Gender;
  concentration: string;
  family: string;
  blurb: string;
  notes: [string[], string[], string[]];
  /** [size, price, compare-at?] */
  sizes: [string, number, number?][];
  sold: number;
  daysOld: number;
  tags?: string[];
  type?: string;
};

const DAY = 86_400_000;
const BASE = Date.UTC(2026, 10, 1);

function demoProduct(d: Demo): Product {
  const image = { url: `/demo/${d.handle}.svg`, altText: `${d.title} ${d.concentration} by ${d.house}`, width: 1200, height: 1200 };
  const prices = d.sizes.map((s) => s[1]);
  const description = d.blurb;
  return {
    id: `demo-${d.handle}`,
    handle: d.handle,
    availableForSale: true,
    title: `${d.title} ${d.concentration}`,
    description,
    descriptionHtml: `<p>${description}</p>`,
    options: [{ id: `${d.handle}-size`, name: 'Size', values: d.sizes.map((s) => s[0]) }],
    priceRange: { minVariantPrice: money(Math.min(...prices)), maxVariantPrice: money(Math.max(...prices)) },
    variants: d.sizes.map(([size, price, compareAt], i) => ({
      id: `demo-${d.handle}-${i}`,
      title: size,
      availableForSale: true,
      selectedOptions: [{ name: 'Size', value: size }],
      price: money(price),
      compareAtPrice: compareAt && compareAt > price ? money(compareAt) : null,
      sku: `DEMO-${d.handle.toUpperCase()}-${size.replace(/\s+/g, '')}`,
      barcode: null
    })),
    featuredImage: image,
    images: [image],
    seo: {
      title: `${d.title} ${d.concentration} by ${d.house}`,
      description: description.slice(0, 160)
    },
    tags: ['demo', ...(d.tags ?? [])],
    vendor: d.house,
    productType: d.type ?? 'Perfume',
    gender: d.gender,
    concentration: d.concentration,
    scentFamily: d.family,
    notes: { top: d.notes[0], heart: d.notes[1], base: d.notes[2] },
    totalSold: d.sold,
    createdAt: new Date(BASE - d.daysOld * DAY).toISOString(),
    updatedAt: new Date(BASE).toISOString()
  };
}

const DEMOS: Demo[] = [
  { handle: 'velours-noir', title: 'Velours Noir', house: 'Maison Démo', gender: 'female', concentration: 'Eau de Parfum', family: 'Amber', blurb: 'A deep, velvety amber built around black plum, night-blooming jasmine and warm vanilla. Rich without being heavy, made for evenings.', notes: [['Black plum', 'Pink pepper'], ['Jasmine', 'Orange blossom'], ['Vanilla', 'Patchouli']], sizes: [['30 ml', 78], ['50 ml', 112, 140], ['90 ml', 158]], sold: 96, daysOld: 120 },
  { handle: 'cedre-bleu', title: 'Cèdre Bleu', house: 'Atelier Exemple', gender: 'male', concentration: 'Eau de Parfum', family: 'Woody', blurb: 'Crisp bergamot over a clean heart of sage and geranium, drying down to blue cedar and amberwood. An easy everyday signature.', notes: [['Bergamot', 'Ginger'], ['Sage', 'Geranium'], ['Cedarwood', 'Amberwood']], sizes: [['60 ml', 96], ['100 ml', 128, 160]], sold: 88, daysOld: 200 },
  { handle: 'fleur-de-minuit', title: 'Fleur de Minuit', house: 'Maison Démo', gender: 'female', concentration: 'Eau de Parfum', family: 'Floral', blurb: 'A bright white-floral bouquet of tuberose and peony with a soft musk finish. Feminine, clean and long-lasting.', notes: [['Pear', 'Mandarin'], ['Tuberose', 'Peony'], ['White musk', 'Sandalwood']], sizes: [['50 ml', 104], ['90 ml', 146]], sold: 74, daysOld: 60 },
  { handle: 'ambre-solaire', title: 'Ambre Solaire', house: 'Sample & Co.', gender: 'unisex', concentration: 'Eau de Parfum', family: 'Amber', blurb: 'Sun-warmed amber, tonka bean and a touch of salted caramel. A golden skin scent that works on everyone.', notes: [['Cardamom', 'Saffron'], ['Amber', 'Labdanum'], ['Tonka bean', 'Benzoin']], sizes: [['50 ml', 118, 148], ['100 ml', 172]], sold: 61, daysOld: 30 },
  { handle: 'oud-imperial', title: 'Oud Impérial', house: 'Sample & Co.', gender: 'unisex', concentration: 'Parfum', family: 'Woody', blurb: 'Smoky oud wrapped in rose and leather. Intense, dark and built to last from morning to night.', notes: [['Saffron', 'Black pepper'], ['Rose', 'Oud'], ['Leather', 'Incense']], sizes: [['50 ml', 186], ['100 ml', 264]], sold: 52, daysOld: 14, tags: ['new'] },
  { handle: 'rose-poivree', title: 'Rose Poivrée', house: 'Atelier Exemple', gender: 'female', concentration: 'Eau de Toilette', family: 'Floral', blurb: 'Fresh-cut rose sharpened with pink pepper and lychee. Light, sparkling and perfect for daytime.', notes: [['Lychee', 'Pink pepper'], ['Rose', 'Magnolia'], ['Cedarwood', 'Musk']], sizes: [['50 ml', 82], ['100 ml', 116]], sold: 47, daysOld: 21, tags: ['new'] },
  { handle: 'cuir-fume', title: 'Cuir Fumé', house: 'Maison Démo', gender: 'male', concentration: 'Eau de Parfum', family: 'Leather', blurb: 'Soft suede, tobacco leaf and smoked vetiver. Confident and warm, with a trail people remember.', notes: [['Grapefruit', 'Cardamom'], ['Suede', 'Tobacco leaf'], ['Vetiver', 'Guaiac wood']], sizes: [['60 ml', 102], ['100 ml', 138]], sold: 44, daysOld: 150 },
  { handle: 'neroli-soleil', title: 'Néroli Soleil', house: 'Atelier Exemple', gender: 'unisex', concentration: 'Eau de Cologne', family: 'Citrus', blurb: 'Bright neroli, lemon zest and petitgrain over a clean musk. A fresh, uplifting splash for warm days.', notes: [['Lemon', 'Petitgrain'], ['Neroli', 'Orange blossom'], ['White musk']], sizes: [['100 ml', 68, 85]], sold: 39, daysOld: 90 },
  { handle: 'vanille-noire', title: 'Vanille Noire', house: 'Sample & Co.', gender: 'female', concentration: 'Eau de Parfum', family: 'Gourmand', blurb: 'Dark vanilla bean, roasted coffee and cocoa. Addictive, cosy and noticeably sweet.', notes: [['Coffee', 'Almond'], ['Vanilla bean', 'Cocoa'], ['Tonka bean', 'Cashmere wood']], sizes: [['30 ml', 72], ['50 ml', 108], ['90 ml', 152]], sold: 83, daysOld: 45 },
  { handle: 'figue-verte', title: 'Figue Verte', house: 'Maison Démo', gender: 'unisex', concentration: 'Eau de Toilette', family: 'Fresh', blurb: 'Green fig leaf, coconut water and driftwood. Like shade under a fig tree by the sea.', notes: [['Fig leaf', 'Bergamot'], ['Fig', 'Coconut water'], ['Driftwood', 'Musk']], sizes: [['50 ml', 88], ['100 ml', 124]], sold: 28, daysOld: 7, tags: ['new'] },
  { handle: 'jardin-blanc', title: 'Jardin Blanc', house: 'Atelier Exemple', gender: 'female', concentration: 'Eau de Toilette', family: 'Floral', blurb: 'Lily of the valley, freesia and dewy green notes. A soft, clean floral that never overwhelms.', notes: [['Green leaves', 'Freesia'], ['Lily of the valley', 'Jasmine'], ['Musk']], sizes: [['50 ml', 76, 95], ['100 ml', 108]], sold: 33, daysOld: 75 },
  { handle: 'coffret-decouverte', title: 'Coffret Découverte', house: 'Maison Démo', gender: 'unisex', concentration: 'Gift Set', family: 'Amber', blurb: 'A full-size Velours Noir with a travel spray in a ready-to-give box. The easiest way to gift a signature scent.', notes: [['Black plum'], ['Jasmine'], ['Vanilla']], sizes: [['Set', 148, 185]], sold: 57, daysOld: 10, tags: ['gift-set', 'new'], type: 'Gift Set' }
];

export const mockProducts: Product[] = DEMOS.map(demoProduct);

const collection = (handle: string, title: string, description: string): Collection => ({
  handle,
  title,
  description,
  image: null,
  seo: { title, description },
  path: handle ? `/collections/${handle}` : '/collections/all',
  updatedAt: new Date(BASE).toISOString()
});

export const mockCollections: Collection[] = [
  collection('', 'All', 'All perfumes'),
  collection('for-her', 'For her', 'Perfumes for women: florals, ambers and gourmands in eau de parfum and eau de toilette.'),
  collection('for-him', 'For him', 'Colognes and perfumes for men: woods, leathers and fresh aromatics.'),
  collection('unisex', 'Unisex', 'Fragrances made to be shared, from bright citrus to smoky oud.'),
  collection('gift-sets', 'Gift sets', 'Ready-to-give perfume gift sets and discovery boxes.')
];

export function mockCollectionProducts(handle: string): Product[] {
  switch (handle) {
    case 'for-her':
      return mockProducts.filter((p) => p.gender === 'female');
    case 'for-him':
      return mockProducts.filter((p) => p.gender === 'male');
    case 'unisex':
      return mockProducts.filter((p) => p.gender === 'unisex' && p.productType !== 'Gift Set');
    case 'gift-sets':
      return mockProducts.filter((p) => p.productType === 'Gift Set');
    case '':
      return mockProducts;
    default:
      return [];
  }
}

export function mockSearch(query?: string): Product[] {
  if (!query) return mockProducts;
  const q = query.toLowerCase();
  return mockProducts.filter((p) =>
    [p.title, p.description, p.vendor, p.scentFamily, ...p.notes.top, ...p.notes.heart, ...p.notes.base]
      .filter(Boolean)
      .some((s) => s!.toLowerCase().includes(q))
  );
}

export const mockCart: Cart = {
  id: 'demo-cart',
  checkoutUrl: '/checkout',
  cost: {
    subtotalAmount: money(0),
    totalAmount: money(0),
    totalTaxAmount: money(0)
  },
  lines: [],
  totalQuantity: 0,
  discountCode: null,
  discountAmount: null
};
