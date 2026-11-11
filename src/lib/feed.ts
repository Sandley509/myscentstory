/**
 * Product feed for Google Merchant Center and Meta Commerce Manager
 * (Facebook Shop + Instagram Shopping).
 *
 * One <item> per variant, in the Google RSS 2.0 format — Meta accepts the same
 * file. Add the URL as a scheduled fetch:
 *   Google → Merchant Center → Products → Feeds → Add → "Scheduled fetch"
 *   Meta   → Commerce Manager → Catalog → Data sources → Data feed → "Scheduled feed"
 */
import 'server-only';

import { getProducts, getStoreSettings } from './commerce';
import { listedShippingCountries } from './countries';
import { DEFAULT_OPTION } from './constants';
import { hasVariants, shippingCostFor, variantUrl } from './seo';
import { absoluteUrl, SITE, siteUrl } from './site';

const esc = (v: string | number) =>
  String(v)
    // Characters XML 1.0 doesn't allow at all.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const tag = (name: string, value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '' : `<${name}>${esc(value)}</${name}>`;

/** GTINs are 8, 12, 13 or 14 digits; anything else would get the item disapproved. */
const validGtin = (v: string | null) => (v && /^(\d{8}|\d{12,14})$/.test(v) ? v : null);

export async function buildProductFeed(): Promise<string> {
  const [products, settings] = await Promise.all([getProducts({}), getStoreSettings()]);
  const storeName = settings.store_name || SITE.name;
  const items: string[] = [];

  for (const product of products) {
    const images = (product.images.length ? product.images : [product.featuredImage]).filter(
      (i) => i.url && !i.url.endsWith('/placeholder.svg')
    );
    // Google and Meta reject listings without a product photo.
    if (!images.length) continue;

    const grouped = hasVariants(product);
    const sizeOption = product.options.find((o) => /size|volume|format/i.test(o.name));
    const brand = product.vendor || storeName;
    const description = (product.description || product.seo.description || product.title).slice(0, 5000);

    for (const variant of product.variants) {
      const price = Number(variant.price.amount);
      if (!(price > 0)) continue;
      const currency = variant.price.currencyCode;
      const size = sizeOption ? variant.selectedOptions.find((o) => o.name === sizeOption.name)?.value : undefined;
      const suffix = variant.title !== DEFAULT_OPTION ? ` - ${variant.title}` : '';
      const title = `${product.title.toLowerCase().includes(brand.toLowerCase()) ? '' : `${brand} `}${product.title}${suffix}`;
      const gtin = validGtin(variant.barcode);
      const shipping = shippingCostFor(settings, price);

      items.push(
        [
          '<item>',
          tag('g:id', variant.id),
          grouped ? tag('g:item_group_id', product.id) : '',
          tag('g:title', title.slice(0, 150)),
          tag('g:description', description),
          tag('g:link', variantUrl(product, variant)),
          tag('g:image_link', absoluteUrl(images[0]!.url)),
          ...images.slice(1, 11).map((i) => tag('g:additional_image_link', absoluteUrl(i.url))),
          tag('g:availability', variant.availableForSale ? 'in_stock' : 'out_of_stock'),
          // On sale: the original goes in `price`, what the shopper pays in `sale_price`.
          tag('g:price', `${(variant.compareAtPrice ?? variant.price).amount} ${currency}`),
          variant.compareAtPrice ? tag('g:sale_price', `${variant.price.amount} ${currency}`) : '',
          tag('g:condition', 'new'),
          tag('g:brand', brand),
          gtin ? tag('g:gtin', gtin) : tag('g:identifier_exists', 'no'),
          variant.sku ? tag('g:mpn', variant.sku) : '',
          tag('g:google_product_category', SITE.googleProductCategory),
          tag('g:product_type', [...new Set([product.productType || 'Perfume', product.concentration].filter(Boolean))].join(' > ')),
          tag('g:gender', product.gender),
          tag('g:age_group', 'adult'),
          tag('g:size', size),
          ...listedShippingCountries(settings).map(
            (country) =>
              `<g:shipping>${tag('g:country', country)}${tag('g:service', 'Standard')}${tag('g:price', `${shipping.toFixed(2)} ${currency}`)}</g:shipping>`
          ),
          '</item>'
        ]
          .filter(Boolean)
          .join('')
      );
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '<channel>',
    tag('title', storeName),
    tag('link', siteUrl),
    tag('description', SITE.description),
    ...items,
    '</channel>',
    '</rss>'
  ].join('\n');
}

export async function feedResponse(): Promise<Response> {
  try {
    return new Response(await buildProductFeed(), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        // Merchant Center fetches once a day; an hour of CDN caching keeps the DB quiet.
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch (e) {
    console.error('[feed]', e);
    return new Response('Feed unavailable', { status: 503 });
  }
}
