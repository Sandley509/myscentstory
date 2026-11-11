'use client';

import { useState, useTransition } from 'react';
import { subscribe } from './cart-actions';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await subscribe(email);
          setState(res.ok ? { ok: true, message: 'Thank you. You’re on the list.' } : { ok: false, message: res.error ?? 'Please try again.' });
          if (res.ok) setEmail('');
        });
      }}
    >
      <label htmlFor="newsletter-email" className="text-xs font-bold uppercase tracking-[0.14em]">
        Connect with us
      </label>
      <input
        id="newsletter-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        className="h-11 w-full bg-white px-3 text-sm text-black outline-none placeholder:text-neutral-500"
      />
      <p className="text-[11px] leading-relaxed text-neutral-400">
        By signing up you agree to receive news and offers from MyScentStory by email. You can unsubscribe at any time.
      </p>
      <button type="submit" disabled={pending} className="btn-light self-start disabled:opacity-60">
        {pending ? 'One moment…' : 'Sign up'}
      </button>
      {state && (
        <p role="status" className={`text-xs ${state.ok ? 'text-white' : 'text-red-300'}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
