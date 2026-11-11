/**
 * Structured data (JSON-LD) builders.
 *
 * Google reads these to show price, availability, shipping and returns in
 * search results and free Shopping listings. They are generated from the same
 * data as the page and the product feed, so the three can never disagree —
 * a price mismatch between them is the most common reason Merchant Center
 * disapproves products.
 */
import type { StoreSettingsRow } from './commerce/db';
import { toNumber } from './commerce/pricing';
import type { Collection, Product, ProductVariant } from './commerce/types';
import { DEFAULT_OPTION } from './constants';
import { listedShippingCountries } from './countries';
import { absoluteUrl, SITE, siteUrl } from './site';

type Json = Record<string, unknown>;

export const hasVariants = (product: Product) =>
  product.variants.length > 1 || product.variants[0]?.title !== DEFAULT_OPTION;

export const variantUrl = (product: Product, variant: ProductVariant) =>
  absoluteUrl(`/products/${product.handle}${product.variants.length > 1 ? `?variant=${variant.id}` : ''}`);

/** Shipping cost for one item, honouring the free-shipping threshold set in /admin. */
export function shippingCostFor(settings: StoreSettingsRow, price: number): number {
  const threshold = toNumber(settings.free_shipping_threshold);
  if (threshold > 0 && price >= threshold) return 0;
  return toNumber(settings.shipping_flat_rate);
}

const GENDER_LABEL = { female: 'female', male: 'male', unisex: 'unisex' } as const;

export function organizationJsonLd(settings: StoreSettingsRow, social: Record<string, string> = SITE.social): Json {
  const sameAs = Object.values(social).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': `${siteUrl}/#organization`,
    name: settings.store_name || SITE.name,
    legalName: SITE.legalName,
    url: siteUrl,
    logo: absoluteUrl('/logo.png'),
    description: SITE.description,
    ...(settings.contact_email ? { email: settings.contact_email } : {}),
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(settings.contact_email
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            email: settings.contact_email,
            ...(settings.phone ? { telephone: settings.phone } : {}),
            availableLanguage: ['English', 'French']
          }
        }
      : {})
  };
}

export function websiteJsonLd(settings: StoreSettingsRow): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    name: settings.store_name || SITE.name,
    url: siteUrl,
    publisher: { '@id': `${siteUrl}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string'
    }
  };
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: absoluteUrl(t.path)
    }))
  };
}

export function collectionJsonLd(collection: Pick<Collection, 'title' | 'description' | 'path'>, products: Product[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collection.title,
    ...(collection.description ? { description: collection.description } : {}),
    url: absoluteUrl(collection.path),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.slice(0, 48).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: absoluteUrl(`/products/${p.handle}`),
        name: p.title
      }))
    }
  };
}

function returnPolicy(settings: StoreSettingsRow): Json {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: listedShippingCountries(settings),
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: SITE.returns.days,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees:
      SITE.returns.paidBy === 'store'
        ? 'https://schema.org/FreeReturn'
        : 'https://schema.org/ReturnFeesCustomerResponsibility',
    merchantReturnLink: absoluteUrl('/pages/returns')
  };
}

function shippingDetails(settings: StoreSettingsRow, price: number, currency: string): Json[] {
  const [hMin, hMax] = SITE.shipping.handlingDays;
  const [tMin, tMax] = SITE.shipping.transitDays;
  return listedShippingCountries(settings).map((country) => ({
    '@type': 'OfferShippingDetails',
    shippingRate: { '@type': 'MonetaryAmount', value: shippingCostFor(settings, price).toFixed(2), currency },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: country },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: hMin, maxValue: hMax, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: tMin, maxValue: tMax, unitCode: 'DAY' }
    }
  }));
}

export function productJsonLd(product: Product, settings: StoreSettingsRow): Json {
  const url = absoluteUrl(`/products/${product.handle}`);
  const images = (product.images.length ? product.images : [product.featuredImage]).map((i) => absoluteUrl(i.url));
  const brand = product.vendor || settings.store_name || SITE.name;
  const policy = returnPolicy(settings);

  const offers = product.variants.map((v) => {
    const price = Number(v.price.amount);
    return {
      '@type': 'Offer',
      url: variantUrl(product, v),
      sku: v.sku || v.id,
      ...(v.barcode ? { gtin: v.barcode } : {}),
      ...(v.title !== DEFAULT_OPTION ? { name: `${product.title} - ${v.title}` } : {}),
      price: v.price.amount,
      priceCurrency: v.price.currencyCode,
      availability: v.availableForSale ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': `${siteUrl}/#organization` },
      shippingDetails: shippingDetails(settings, price, v.price.currencyCode),
      hasMerchantReturnPolicy: policy
    };
  });

  const properties = [
    product.concentration && { name: 'Concentration', value: product.concentration },
    product.scentFamily && { name: 'Scent family', value: product.scentFamily },
    product.notes.top.length && { name: 'Top notes', value: product.notes.top.join(', ') },
    product.notes.heart.length && { name: 'Heart notes', value: product.notes.heart.join(', ') },
    product.notes.base.length && { name: 'Base notes', value: product.notes.base.join(', ') }
  ].filter(Boolean) as { name: string; value: string }[];

  const first = product.variants[0];

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.title,
    description: product.seo.description || product.description,
    url,
    image: images,
    brand: { '@type': 'Brand', name: brand },
    category: 'Perfume & Cologne',
    ...(first ? { sku: first.sku || first.id } : {}),
    ...(first?.barcode ? { gtin: first.barcode } : {}),
    ...(product.gender
      ? { audience: { '@type': 'PeopleAudience', suggestedGender: GENDER_LABEL[product.gender] } }
      : {}),
    ...(properties.length
      ? { additionalProperty: properties.map((p) => ({ '@type': 'PropertyValue', ...p })) }
      : {}),
    offers:
      offers.length === 1
        ? offers[0]
        : {
            '@type': 'AggregateOffer',
            lowPrice: product.priceRange.minVariantPrice.amount,
            highPrice: product.priceRange.maxVariantPrice.amount,
            priceCurrency: product.priceRange.minVariantPrice.currencyCode,
            offerCount: offers.length,
            offers
          }
  };
}
