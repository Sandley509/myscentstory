'use client';

import { Toast } from '@/components/admin/overlays';
import { Badge, Button, EmptyState, Thumbnail } from '@/components/admin/ui';
import type { AbandonedCart } from '@/lib/admin/abandoned';
import { sendCartReminder } from '@/lib/admin/actions/abandoned';
import { formatMoney } from '@/lib/admin/format';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

function when(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' });
}

function ReminderButton({ cart, canEmail, onDone }: { cart: AbandonedCart; canEmail: boolean; onDone: (msg: string) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!cart.email) return <span className="text-admin-subdued">No email</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="slim"
        disabled={!canEmail || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await sendCartReminder(cart.id);
            if (!res.ok) return setError(res.error);
            onDone(`Reminder sent to ${res.data.sentTo}`);
            router.refresh();
          })
        }
      >
        {pending ? 'Sending…' : cart.reminderSentAt ? 'Send again' : 'Send reminder'}
      </Button>
      {cart.reminderSentAt && !error && <span className="text-[12px] text-admin-subdued">Sent {when(cart.reminderSentAt)}</span>}
      {error && <span className="text-[12px] text-admin-critical">{error}</span>}
    </div>
  );
}

export function AbandonedCartsTable({ carts, currency, canEmail }: { carts: AbandonedCart[]; currency: string; canEmail: boolean }) {
  const [toast, setToast] = useState<string | null>(null);
  if (!carts.length) {
    return (
      <EmptyState heading="No abandoned carts">Carts left for over an hour without buying will show up here.</EmptyState>
    );
  }
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-admin-border bg-[#f7f7f7] text-[12px] text-admin-subdued">
            <tr>
              <th className="px-4 py-2 font-medium">Last activity</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Items</th>
              <th className="px-4 py-2 text-right font-medium">Value</th>
              <th className="px-4 py-2 font-medium">Reminder</th>
            </tr>
          </thead>
          <tbody>
            {carts.map((c) => (
              <tr key={c.id} className="border-b border-admin-border align-top last:border-b-0">
                <td className="whitespace-nowrap px-4 py-3">
                  {when(c.activityAt)}
                  <div className="mt-1">
                    {c.reachedCheckout ? <Badge tone="attention">Reached checkout</Badge> : <Badge>In cart</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="text-admin-link hover:underline">
                      {c.email}
                    </a>
                  ) : (
                    <span className="text-admin-subdued">Unknown</span>
                  )}
                  {c.discountCode && <div className="mt-1 text-[12px] text-admin-subdued">Code {c.discountCode}</div>}
                </td>
                <td className="px-4 py-3">
                  <ul className="flex flex-col gap-2">
                    {c.items.map((i, k) => (
                      <li key={k} className="flex items-center gap-2">
                        <Thumbnail src={i.imageUrl} size={32} />
                        <span>
                          {i.title}
                          {i.variantTitle ? <span className="text-admin-subdued"> · {i.variantTitle}</span> : null}
                          <span className="text-admin-subdued"> × {i.quantity}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatMoney(c.value, currency)}</td>
                <td className="px-4 py-3">
                  <ReminderButton cart={c} canEmail={canEmail} onDone={setToast} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
