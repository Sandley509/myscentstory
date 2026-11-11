import { Breadcrumbs } from '@/components/store/breadcrumbs';
import { JsonLd } from '@/components/store/json-ld';
import { ProductGrid } from '@/components/store/product-card';
import { ProductDetails } from '@/components/store/product-details';
import { getProduct, getProductRecommendations, getStoreSettings } from '@/lib/commerce';
import { toNumber } from '@/lib/commerce/pricing';
import { HIDDEN_PRODUCT_TAG } from '@/lib/constants';
import { productJsonLd } from '@/lib/seo';
import { SITE } from '@/lib/site';
import { Money } from '@/components/store/currency';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ handle: string }> };

// Product pages are cached and rebuilt in the background (at most every 5
// minutes, and at once when the product is saved in /admin).
export const revalidate = 300;
export const generateStaticParams = () => [];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProduct(handle).catch(() => undefined);
  if (!product) return { title: 'Product not found' };

  const url = `/products/${product.handle}`;
  const image = product.featuredImage;
  return {
    title: product.seo.title,
    description: product.seo.description,
    alternates: { canonical: url },
    robots: product.tags.includes(HIDDEN_PRODUCT_TAG) ? { index: false, follow: false } : undefined,
    openGraph: {
      siteName: SITE.name,
      locale: SITE.locale,
      title: product.seo.title,
      description: product.seo.description,
      url,
      images: [{ url: image.url, width: image.width, height: image.height, alt: image.altText || product.title }]
    },
    twitter: { card: 'summary_large_image', title: product.seo.title, description: product.seo.description, images: [image.url] },
  };
}

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const product = await getProduct(handle).catch((e) => {
    console.error(`[products/${handle}]`, e);
    return undefined;
  });
  if (!product) notFound();

  const [related, settings] = await Promise.all([
    getProductRecommendations(product.id).catch(() => []),
    getStoreSettings()
  ]);
  const threshold = toNumber(settings.free_shipping_threshold);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <JsonLd data={productJsonLd(product, settings)} />
      {/* Product tags read by Facebook, Instagram and Pinterest. React moves <meta> into <head>. */}
      <meta property="og:type" content="product" />
      <meta property="product:price:amount" content={product.priceRange.minVariantPrice.amount} />
      <meta property="product:price:currency" content={product.priceRange.minVariantPrice.currencyCode} />
      <meta property="product:availability" content={product.availableForSale ? 'in stock' : 'out of stock'} />
      <meta property="product:condition" content="new" />
      {product.vendor && <meta property="product:brand" content={product.vendor} />}
      <Breadcrumbs
        trail={[
          { name: 'All perfumes', path: '/collections/all' },
          { name: product.title, path: `/products/${product.handle}` }
        ]}
      />

      <div className="mt-6">
        <ProductDetails product={product}>
          <ul className="mt-6 space-y-1.5 text-xs text-muted">
            <li>
              {threshold > 0 ? (
                <>
                  Free worldwide shipping on orders over <Money amount={threshold} currencyCode={settings.currency} />.{' '}
                </>
              ) : (
                <>
                  <Money amount={toNumber(settings.shipping_flat_rate)} currencyCode={settings.currency} /> flat-rate shipping.{' '}
                </>
              )}
              Delivery in {SITE.shipping.handlingDays[0] + SITE.shipping.transitDays[0]} to{' '}
              {SITE.shipping.handlingDays[1] + SITE.shipping.transitDays[1]} days.{' '}
              <Link href="/pages/shipping" className="underline">Shipping details</Link>
            </li>
            <li>
              {SITE.returns.days}-day returns on unopened items.{' '}
              <Link href="/pages/returns" className="underline">Return policy</Link>
            </li>
          </ul>
        </ProductDetails>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-20">
          <h2 id="related-heading" className="heading-caps mb-8 text-center text-2xl">
            You may also adore
          </h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
