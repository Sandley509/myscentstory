'use client';

import type { Cart } from '@/lib/commerce/types';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { refreshCart } from './cart-actions';

type CartContextValue = {
  cart: Cart | undefined;
  /** Adopt the cart a server action returned. */
  setCart: (cart: Cart | undefined) => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ initialCart, children }: { initialCart?: Cart; children: ReactNode }) {
  const [cart, setCart] = useState<Cart | undefined>(initialCart);
  const [isOpen, setIsOpen] = useState(false);

  // The server-rendered copy can be stale (layouts don't re-render after a
  // server action), so resync once on mount.
  useEffect(() => {
    let cancelled = false;
    refreshCart().then((fresh) => {
      if (!cancelled) setCart(fresh);
    });
    // Arriving from a cart reminder email (/cart/recover → /?cart=open): show the cart.
    const url = new URL(window.location.href);
    if (url.searchParams.get('cart') === 'open') {
      setIsOpen(true);
      url.searchParams.delete('cart');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CartContext.Provider
      value={{ cart, setCart, isOpen, openCart: () => setIsOpen(true), closeCart: () => setIsOpen(false) }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
