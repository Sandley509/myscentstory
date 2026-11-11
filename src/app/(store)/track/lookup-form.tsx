'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { lookupOrder } from './actions';

export function LookupForm({ notice }: { notice?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(lookupOrder, {});
  // Controlled, so a failed lookup doesn't wipe what the customer typed
  // (React resets uncontrolled fields after a form action).
  const [order, setOrder] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (state.url) router.push(state.url);
  }, [state.url, router]);

  return (
    <form action={action} className="mx-auto mt-8 flex max-w-md flex-col gap-4">
      {notice && !state.error && (
        <p role="status" className="border border-line bg-surface px-4 py-3 text-sm">
          {notice}
        </p>
      )}
      <label className="flex flex-col gap-1.5 text-left">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Order number</span>
        <input name="order" required inputMode="numeric" autoComplete="off" placeholder="e.g. 1001" value={order} onChange={(e) => setOrder(e.target.value)} className="h-12 border border-fg px-4 text-sm outline-none" />
      </label>
      <label className="flex flex-col gap-1.5 text-left">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Email used for the order</span>
        <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 border border-fg px-4 text-sm outline-none" />
      </label>
      <button type="submit" disabled={pending || !!state.url} className="btn-solid">
        {pending || state.url ? 'Looking it up…' : 'Track order'}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <p className="text-xs text-muted">Your order number is in your confirmation email (for example #1001).</p>
    </form>
  );
}
