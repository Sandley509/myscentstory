'use client';

import type { AttributeInput, Product, ProductVariant } from '@/lib/commerce/types';
import { trackAddToCart, trackViewItem } from '@/lib/track';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { addItem } from './cart-actions';
import { useCart } from './cart-context';
import { ChargeNotice, Money } from './currency';
import { productBadges, savingLabel } from './product-card';

const GENDER_TEXT = { female: 'For her', male: 'For him', unisex: 'Unisex' } as const;

/**
 * Product page: gallery, size picker, quantity, add to cart, fragrance notes.
 *
 * `extraAttributes` lets a project attach custom line-item data (engraving,
 * gift message) to the cart line; it shows up on the order in /admin.
 * `children` renders under the buy box (shipping and returns summary).
 */
export function ProductDetails({
  product,
  extraAttributes,
  children
}: {
  product: Product;
  extraAttributes?: AttributeInput[];
  children?: ReactNode;
}) {
  const { setCart, openCart } = useCart();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);

  const realOptions = product.options.filter((o) => o.name !== 'Title');
  const optionsOf = (v: ProductVariant | undefined) =>
    Object.fromEntries((v?.selectedOptions ?? []).map((o) => [o.name, o.value]));

  const [selected, setSelected] = useState<Record<string, string>>(() =>
    optionsOf(product.variants.find((v) => v.availableForSale) ?? product.variants[0])
  );

  // Shopping ads link to one exact size with ?variant=<id>; open on that size
  // so the price on the page matches the price in the ad.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('variant');
    const match = wanted && product.variants.find((v) => v.id === wanted);
    if (match) setSelected(optionsOf(match));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const variant: ProductVariant | undefined = useMemo(() => {
    const match = product.variants.find((v) => v.selectedOptions.every((o) => selected[o.name] === o.value));
    return match ?? product.variants.find((v) => v.availableForSale) ?? product.variants[0];
  }, [product.variants, selected]);

  const images = product.images.length ? product.images : [product.featuredImage];
  const price = variant?.price ?? product.priceRange.minVariantPrice;
  const compareAt = variant?.compareAtPrice ?? null;
  const soldOut = !variant?.availableForSale;
  const saving = savingLabel(price.amount, compareAt?.amount);
  const badges = [...productBadges(product), ...(saving ? [saving] : [])];

  useEffect(() => {
    if (!variant) return;
    trackViewItem(
      { id: variant.id, name: product.title, brand: product.vendor, variant: variant.title, price: Number(variant.price.amount), quantity: 1 },
      variant.price.currencyCode
    );
    // One view per product, not one per size click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const add = () =>
    start(async () => {
      setError(null);
      if (!variant) return setError('This product is unavailable.');
      const res = await addItem({ variantId: variant.id, quantity, attributes: extraAttributes });
      if (!res.ok) return setError(res.error ?? 'Could not add to cart.');
      setCart(res.cart);
      openCart();
      trackAddToCart(
        { id: variant.id, name: product.title, brand: product.vendor, variant: variant.title, price: Number(variant.price.amount), quantity },
        variant.price.currencyCode
      );
    });

  const facts = [product.concentration, product.gender && GENDER_TEXT[product.gender], product.scentFamily].filter(Boolean);
  const pyramid = [
    { label: 'Top notes', notes: product.notes.top },
    { label: 'Heart notes', notes: product.notes.heart },
    { label: 'Base notes', notes: product.notes.base }
  ].filter((n) => n.notes.length);

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div>
        <div className="relative aspect-square overflow-hidden bg-surface">
          <Image
            src={images[imageIndex]!.url}
            alt={images[imageIndex]!.altText || product.title}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          {badges.length > 0 && (
            <ul className="absolute left-3 top-3 flex flex-col items-start gap-1">
              {badges.map((b) => (
                <li key={b} className="bg-neutral-600 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">{b}</li>
              ))}
            </ul>
          )}
        </div>
        {images.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {images.map((img, i) => (
              <button
                key={img.url + i}
                type="button"
                onClick={() => setImageIndex(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === imageIndex}
                className={`relative h-20 w-20 shrink-0 overflow-hidden border ${i === imageIndex ? 'border-fg' : 'border-line'}`}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        {product.vendor && (
          <p className="eyebrow text-muted">
            <Link href={`/search?q=${encodeURIComponent(product.vendor)}`} className="hover:text-fg">{product.vendor}</Link>
          </p>
        )}
        <h1 className="heading-caps mt-2 text-2xl leading-tight lg:text-3xl">{product.title}</h1>
        {facts.length > 0 && <p className="mt-2 text-sm text-muted">{facts.join(' · ')}</p>}

        <p className="mt-5 flex items-baseline gap-3 text-xl">
          {compareAt && (
            <>
              <span className="sr-only">Regular price</span>
              <s className="text-base text-muted"><Money amount={compareAt.amount} currencyCode={compareAt.currencyCode} /></s>
              <span className="sr-only">Sale price</span>
            </>
          )}
          <span className="font-semibold"><Money amount={price.amount} currencyCode={price.currencyCode} /></span>
        </p>

        <ChargeNotice amount={price.amount} className="mt-2" />

        {realOptions.length > 0 && (
          <div className="mt-6 space-y-5">
            {realOptions.map((option) => (
              <fieldset key={option.id}>
                <legend className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em]">
                  {option.name}: <span className="font-normal text-muted">{selected[option.name]}</span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {option.values.map((value) => {
                    const isSelected = selected[option.name] === value;
                    const available = product.variants.some(
                      (v) =>
                        v.availableForSale &&
                        v.selectedOptions.every((o) => (o.name === option.name ? o.value === value : selected[o.name] === o.value))
                    );
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSelected((s) => ({ ...s, [option.name]: value }))}
                        aria-pressed={isSelected}
                        title={available ? undefined : 'Out of stock'}
                        className={`min-w-16 border px-4 py-2.5 text-xs uppercase tracking-[0.08em] transition-colors ${
                          isSelected ? 'border-fg bg-fg text-white' : 'border-line hover:border-fg'
                        } ${available ? '' : 'text-muted line-through'}`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-stretch gap-3">
          <div className="flex items-center border border-fg">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity" className="h-12 w-10">
              −
            </button>
            <span aria-live="polite" className="w-8 text-center text-sm">{quantity}</span>
            <button type="button" onClick={() => setQuantity((q) => Math.min(99, q + 1))} aria-label="Increase quantity" className="h-12 w-10">
              +
            </button>
          </div>
          <button type="button" onClick={add} disabled={pending || soldOut} className="btn-solid flex-1">
            {soldOut ? 'Sold out' : pending ? 'Adding…' : 'Add to cart'}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}

        {children}

        {pyramid.length > 0 && (
          <section aria-labelledby="notes-heading" className="mt-8 border-t border-line pt-6">
            <h2 id="notes-heading" className="text-[11px] font-bold uppercase tracking-[0.14em]">Fragrance notes</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              {pyramid.map((n) => (
                <div key={n.label} className="bg-surface p-4">
                  <dt className="eyebrow text-brand-600">{n.label}</dt>
                  <dd className="mt-1.5">{n.notes.join(', ')}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {product.descriptionHtml && (
          <section aria-labelledby="description-heading" className="mt-8 border-t border-line pt-6">
            <h2 id="description-heading" className="text-[11px] font-bold uppercase tracking-[0.14em]">Description</h2>
            <div className="prose-store mt-3 text-sm text-neutral-700" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
          </section>
        )}
      </div>
    </div>
  );
}
