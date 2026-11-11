'use client';

import type { SiteContent } from '@/lib/content';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { subscribe } from './cart-actions';
import { CloseIcon } from './icons';
import { readWelcome, writeWelcome } from './welcome-storage';

const DELAY_MS = 6000;

/**
 * Shown at most once per page load, even if the component is remounted (client
 * navigation, a re-render after a cart action, Fast Refresh in development).
 */
let shownThisLoad = false;

/**
 * First-visit offer: shown once, a few seconds after the first page view (or
 * when the visitor scrolls halfway). Never on checkout or order pages.
 */
export function WelcomeOffer({ offer }: { offer: SiteContent['welcome'] }) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const blocked = /^\/(checkout|track)/.test(pathname);

  useEffect(() => {
    if (!offer.enabled || !offer.code || blocked || shownThisLoad || readWelcome()) return;
    let done = false;
    const stop = () => {
      done = true;
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
    // Opens at most once per page load, and never after it was closed or claimed
    // (also in another tab): the scroll trigger used to reopen it after "No thanks".
    const show = () => {
      if (done || shownThisLoad) return;
      stop();
      // Checked again here: the visitor may have dismissed it in another tab.
      if (readWelcome()) return;
      shownThisLoad = true;
      setOpen(true);
    };
    const onScroll = () => {
      if (window.scrollY > document.body.scrollHeight * 0.4) show();
    };
    const timer = window.setTimeout(show, DELAY_MS);
    window.addEventListener('scroll', onScroll, { passive: true });
    return stop;
  }, [offer.enabled, offer.code, blocked]);

  useEffect(() => {
    if (!open) return;
    // Focus the dialog itself: focusing the email field would pop the phone keyboard up.
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    shownThisLoad = true;
    if (!claimed) writeWelcome({ status: 'dismissed', at: Date.now() });
    setOpen(false);
  };

  const claim = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const res = await subscribe(email);
      if (!res.ok) return setError(res.error ?? 'Please try again.');
      writeWelcome({ status: 'claimed', code: offer.code, email: email.trim().toLowerCase(), at: Date.now() });
      setClaimed(true);
    });
  };

  if (!open) return null;

  return createPortal(
    <div className="store-root fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button aria-label="Close" className="absolute inset-0 bg-black/50" onClick={close} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        tabIndex={-1}
        className="relative outline-none w-full max-w-md overflow-hidden bg-page text-center shadow-2xl"
      >
        <button onClick={close} aria-label="Close" className="absolute right-1 top-1 z-10 flex h-11 w-11 items-center justify-center text-white hover:opacity-80">
          <CloseIcon />
        </button>
        <div className="bg-[radial-gradient(120%_140%_at_15%_0%,#5b0043_0%,#1a0614_60%,#000_100%)] px-8 pb-8 pt-10 text-white">
          <p className="eyebrow text-accent">Welcome to MyScentStory</p>
          <h2 id="welcome-title" className="heading-caps mt-3 text-3xl leading-tight">
            {offer.title}
          </h2>
        </div>

        <div className="px-8 py-7">
          {claimed ? (
            <>
              <p className="text-sm text-muted">Your code</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(offer.code).then(() => setCopied(true), () => undefined);
                }}
                className="mt-2 w-full border-2 border-dashed border-brand-600 py-3 text-2xl font-bold tracking-[0.2em] text-brand-600"
                aria-label={`Copy code ${offer.code}`}
              >
                {offer.code}
              </button>
              <p className="mt-2 text-xs text-muted" aria-live="polite">
                {copied ? 'Copied.' : 'Tap to copy.'} It’s saved: we’ll apply it to your cart automatically.
              </p>
              <button type="button" onClick={close} className="btn-solid mt-5 w-full">
                Start shopping
              </button>
            </>
          ) : (
            <form onSubmit={claim} className="flex flex-col gap-3">
              {offer.text && <p className="text-sm text-muted">{offer.text}</p>}
              <label htmlFor="welcome-email" className="sr-only">
                Email address
              </label>
              <input
                id="welcome-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="h-12 border border-fg px-4 text-sm outline-none"
              />
              <button type="submit" disabled={pending} className="btn-solid w-full">
                {pending ? 'One moment…' : 'Get my 10% code'}
              </button>
              {error && (
                <p role="alert" className="text-xs text-danger">
                  {error}
                </p>
              )}
              <button type="button" onClick={close} className="text-xs text-muted underline">
                No thanks
              </button>
              <p className="text-[10px] leading-relaxed text-muted">
                First order only, one per customer. You’ll receive emails from MyScentStory and can unsubscribe at any time.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
