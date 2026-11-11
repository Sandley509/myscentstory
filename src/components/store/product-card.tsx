'use client';

import type { Product } from '@/lib/commerce/types';
import { DEFAULT_OPTION } from '@/lib/constants';
import { trackAddToCart } from '@/lib/track';
import Image from 'next/image';
import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { addItem } from './cart-actions';
import { useCart } from './cart-context';
import { Money } from './currency';

const NEW_WINDOW_DAYS = 45;

export function productBadges(product: Product): string[] {
  const badges: string[] = [];
  const tags = product.tags.map((t) => t.toLowerCase());
  const ageDays = (Date.now() - new Date(product.createdAt).getTime()) / 86_400_000;
  if (tags.includes('new') || ageDays < NEW_WINDOW_DAYS) badges.push('New');
  if (tags.includes('bestseller') || tags.includes('best-seller')) badges.push('Bestseller');
  return badges;
}

/** "20% off" for a variant on sale, from its real compare-at price. */
export function savingLabel(price: string, compareAt?: string | null): string | null {
  if (!compareAt) return null;
  const pct = Math.round((1 - Number(price) / Number(compareAt)) * 100);
  return pct > 0 ? `${pct}% off` : null;
}

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { setCart, openCart } = useCart();
  const selectId = useId();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [variantId, setVariantId] = useState(
    () => (product.variants.find((v) => v.availableForSale) ?? product.variants[0])?.id ?? ''
  );

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const href = `/products/${product.handle}`;
  const optionName = product.options[0]?.name === 'Title' ? 'Option' : (product.options[0]?.name ?? 'Option');
  const multiple = product.variants.length > 1;
  const soldOut = !variant?.availableForSale;
  const saving = variant ? savingLabel(variant.price.amount, variant.compareAtPrice?.amount) : null;
  const badges = [...productBadges(product), ...(saving ? [saving] : [])];

  const add = () =>
    start(async () => {
      setError(null);
      if (!variant) return;
      const res = await addItem({ variantId: variant.id, quantity: 1 });
      if (!res.ok) return setError(res.error ?? 'Could not add to cart.');
      setCart(res.cart);
      openCart();
      trackAddToCart(
        { id: variant.id, name: product.title, brand: product.vendor, variant: variant.title, price: Number(variant.price.amount), quantity: 1 },
        variant.price.currencyCode
      );
    });

  return (
    <article className="flex h-full flex-col">
      <Link href={href} className="group relative block" tabIndex={-1} aria-hidden="true">
        <div className="relative aspect-square overflow-hidden bg-surface">
          <Image
            src={product.featuredImage.url}
            alt={product.featuredImage.altText || product.title}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
        {badges.length > 0 && (
          <ul className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {badges.map((b) => (
              <li key={b} className="bg-neutral-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white">
                {b}
              </li>
            ))}
          </ul>
        )}
      </Link>

      <div className="mt-3 flex flex-1 flex-col border-t-2 border-fg pt-3 text-center">
        {product.vendor && <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{product.vendor}</p>}
        <h3 className="mt-1 text-xs font-bold uppercase leading-snug tracking-[0.06em]">
          <Link href={href} className="hover:text-brand-600">
            {product.title}
          </Link>
        </h3>
        <p className="mx-auto mt-2 line-clamp-2 max-w-[26ch] text-[11px] leading-snug text-muted">{product.description}</p>

        <div className="mt-auto pt-3">
          {multiple ? (
            <div className="relative border border-fg text-left">
              <label htmlFor={selectId} className="absolute -top-2 left-2 bg-page px-1 text-[9px] uppercase tracking-[0.1em] text-muted">
                {optionName}
              </label>
              <select
                id={selectId}
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                className="h-10 w-full appearance-none bg-transparent px-3 text-xs uppercase tracking-[0.06em] outline-none"
              >
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id} disabled={!v.availableForSale}>
                    {v.title}
                    {v.availableForSale ? '' : ' (sold out)'}
                  </option>
                ))}
              </select>
              <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px]">▾</span>
            </div>
          ) : (
            <p className="flex h-10 items-center justify-center text-[11px] uppercase tracking-[0.08em] text-muted">
              {variant && variant.title !== DEFAULT_OPTION ? variant.title : 'One size'}
            </p>
          )}

          {variant && (
            <p className="mt-3 text-left text-sm">
              {variant.compareAtPrice && (
                <>
                  <span className="sr-only">Regular price</span>
                  <s className="mr-2 text-muted"><Money amount={variant.compareAtPrice.amount} currencyCode={variant.compareAtPrice.currencyCode} /></s>
                  <span className="sr-only">Sale price</span>
                </>
              )}
              <span className="font-semibold"><Money amount={variant.price.amount} currencyCode={variant.price.currencyCode} /></span>
            </p>
          )}

          <button type="button" onClick={add} disabled={pending || soldOut} className="btn-solid mt-2 w-full">
            {soldOut ? 'Sold out' : pending ? 'Adding…' : 'Add to cart'}
            <span className="sr-only">: {product.title}</span>
          </button>
          {error && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: Product[]; priorityCount?: number }) {
  if (!products.length) {
    return <p className="py-16 text-center text-muted">No perfumes found.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-12 lg:grid-cols-4 lg:gap-x-6">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
