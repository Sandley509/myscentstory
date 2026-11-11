'use client';

import type { Cart } from '@/lib/commerce/types';
import { trackBeginCheckout } from '@/lib/track';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { applyDiscount, checkout, removeLine, updateLineQuantity } from './cart-actions';
import { useCart } from './cart-context';
import { ChargeNotice, Money } from './currency';
import { BagIcon, CloseIcon } from './icons';
import { readWelcome, writeWelcome } from './welcome-storage';

/**
 * Cart drawer. Portalled to <body> on purpose: any ancestor with a filter or
 * `backdrop-blur` creates a containing block and breaks `position: fixed`.
 */
/** `freeShippingOver`: subtotal for free shipping (0 = none), for the progress hint. */
export function CartDrawer({ freeShippingOver = 0 }: { freeShippingOver?: number }) {
  const { cart, setCart, isOpen, openCart, closeCart } = useCart();
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [needsEmail, setNeedsEmail] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; cart?: Cart; needsEmail?: boolean }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) {
        setCart(res.cart);
        setNeedsEmail(false);
      } else {
        setError(res.error ?? 'Something went wrong.');
        if (res.needsEmail) setNeedsEmail(true);
      }
    });

  // A welcome code claimed in the first-visit popup is applied automatically,
  // once per cart, with the email the shopper gave there.
  useEffect(() => {
    if (!isOpen || !cart?.id || !cart.lines.length || cart.discountCode || pending) return;
    const welcome = readWelcome();
    if (welcome?.status !== 'claimed' || !welcome.code || welcome.appliedTo === cart.id) return;
    writeWelcome({ ...welcome, appliedTo: cart.id });
    setCode(welcome.code);
    if (welcome.email) setEmail(welcome.email);
    run(() => applyDiscount(welcome.code!, welcome.email));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cart?.id, cart?.lines.length, cart?.discountCode]);

  const quantity = cart?.totalQuantity ?? 0;
  const currency = cart?.cost.totalAmount.currencyCode ?? 'CAD';

  return (
    <>
      <button
        type="button"
        onClick={openCart}
        aria-label={`Open cart, ${quantity} item${quantity === 1 ? '' : 's'}`}
        className="relative p-2 transition-colors hover:text-brand-600"
      >
        <BagIcon width={22} height={22} />
        {quantity > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
            {quantity}
          </span>
        )}
      </button>

      {mounted &&
        isOpen &&
        createPortal(
          <div className="store-root fixed inset-0 z-50 flex justify-end">
            <button className="absolute inset-0 bg-black/40" aria-label="Close cart" onClick={closeCart} />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Cart"
              className="relative flex h-full w-full max-w-md flex-col bg-page shadow-xl"
            >
              <header className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="heading-caps text-sm">Your cart</h2>
                <button onClick={closeCart} aria-label="Close cart" className="p-2 hover:text-brand-600">
                  <CloseIcon />
                </button>
              </header>

              {!cart?.lines.length ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="text-muted">Your cart is empty.</p>
                  <Link href="/collections/all" onClick={closeCart} className="btn-outline">
                    Shop perfumes
                  </Link>
                </div>
              ) : (
                <>
                  <ul className="flex-1 overflow-y-auto px-5">
                    {cart.lines.map((line) => (
                      <li key={line.id} className="flex gap-3 border-b border-line py-4">
                        <Image
                          src={line.merchandise.product.featuredImage.url}
                          alt={line.merchandise.product.featuredImage.altText || line.merchandise.product.title}
                          width={72}
                          height={72}
                          className="h-[72px] w-[72px] bg-surface object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/products/${line.merchandise.product.handle}`}
                            onClick={closeCart}
                            className="text-xs font-bold uppercase tracking-[0.06em] hover:text-brand-600"
                          >
                            {line.merchandise.product.title}
                          </Link>
                          {line.merchandise.title !== 'Default Title' && (
                            <p className="text-sm text-muted">{line.merchandise.title}</p>
                          )}
                          {line.attributes?.map((a) => (
                            <p key={a.key} className="truncate text-xs text-muted">
                              {a.key}: {a.value}
                            </p>
                          ))}
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex items-center border border-line">
                              <button
                                aria-label="Decrease quantity"
                                disabled={pending}
                                onClick={() =>
                                  run(() =>
                                    updateLineQuantity({
                                      lineId: line.id!,
                                      variantId: line.merchandise.id,
                                      quantity: line.quantity - 1
                                    })
                                  )
                                }
                                className="px-3 py-1 disabled:opacity-50"
                              >
                                −
                              </button>
                              <span className="w-6 text-center text-sm">{line.quantity}</span>
                              <button
                                aria-label="Increase quantity"
                                disabled={pending}
                                onClick={() =>
                                  run(() =>
                                    updateLineQuantity({
                                      lineId: line.id!,
                                      variantId: line.merchandise.id,
                                      quantity: line.quantity + 1
                                    })
                                  )
                                }
                                className="px-3 py-1 disabled:opacity-50"
                              >
                                +
                              </button>
                            </div>
                            <button
                              disabled={pending}
                              onClick={() => run(() => removeLine(line.id!))}
                              className="text-xs text-muted underline disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <p className="whitespace-nowrap text-sm font-medium">
                          <Money amount={line.cost.totalAmount.amount} currencyCode={line.cost.totalAmount.currencyCode} />
                        </p>
                      </li>
                    ))}
                  </ul>

                  <footer className="border-t border-line px-5 py-4">
                    {cart.discountCode ? (
                      <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0">
                          <span className="bg-surface px-3 py-1 font-medium">{cart.discountCode}</span>
                          {cart.email && <span className="ml-2 truncate text-xs text-muted">for {cart.email}</span>}
                        </span>
                        <button disabled={pending} onClick={() => run(() => applyDiscount(''))} className="text-muted underline">
                          Remove
                        </button>
                      </div>
                    ) : (
                      <form
                        className="mb-3 flex flex-wrap gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (code.trim()) run(() => applyDiscount(code, needsEmail ? email : undefined));
                        }}
                      >
                        {needsEmail && (
                          <input
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email you’ll order with"
                            aria-label="Email you’ll order with"
                            className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-fg"
                          />
                        )}
                        <input
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          placeholder="Discount code"
                          aria-label="Discount code"
                          className="min-w-0 flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-fg"
                        />
                        <button
                          type="submit"
                          disabled={pending || !code.trim()}
                          className="border border-fg px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                        >
                          Apply
                        </button>
                      </form>
                    )}

                    <dl className="mb-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted">Subtotal</dt>
                        <dd><Money amount={cart.cost.subtotalAmount.amount} currencyCode={currency} /></dd>
                      </div>
                      {cart.discountAmount && Number(cart.discountAmount.amount) > 0 && (
                        <div className="flex justify-between">
                          <dt className="text-muted">Discount</dt>
                          <dd>−<Money amount={cart.discountAmount.amount} currencyCode={currency} /></dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt className="text-muted">Shipping &amp; taxes</dt>
                        <dd className="text-muted">Calculated at checkout</dd>
                      </div>
                      <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                        <dt>Total</dt>
                        <dd><Money amount={cart.cost.totalAmount.amount} currencyCode={currency} /></dd>
                      </div>
                    </dl>

                    {freeShippingOver > 0 && (() => {
                      const spent = Number(cart.cost.totalAmount.amount);
                      const left = freeShippingOver - spent;
                      return (
                        <div className="mb-3">
                          <p className="text-xs">
                            {left > 0 ? (
                              <>
                                Add <Money amount={left} currencyCode={currency} className="font-semibold" /> more for free shipping.
                              </>
                            ) : (
                              <span className="font-semibold text-success">Your order ships free.</span>
                            )}
                          </p>
                          <div className="mt-1.5 h-1 bg-line" aria-hidden>
                            <div className="h-1 bg-brand-600" style={{ width: `${Math.min(100, (spent / freeShippingOver) * 100)}%` }} />
                          </div>
                        </div>
                      );
                    })()}
                    <ChargeNotice className="mb-3" />
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          setError(null);
                          trackBeginCheckout(
                            cart.lines.map((l) => ({
                              id: l.merchandise.id,
                              name: l.merchandise.product.title,
                              variant: l.merchandise.title,
                              price: Number(l.cost.totalAmount.amount) / l.quantity,
                              quantity: l.quantity
                            })),
                            currency
                          );
                          const res = await checkout();
                          if (res && res.ok === false) setError(res.error);
                        })
                      }
                      className="btn-solid w-full"
                    >
                      {pending ? 'One moment…' : 'Checkout'}
                    </button>
                    {error && (
                      <p role="alert" className="mt-2 text-center text-xs text-danger">
                        {error}
                      </p>
                    )}
                  </footer>
                </>
              )}
            </aside>
          </div>,
          document.body
        )}
    </>
  );
}