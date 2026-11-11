'use client';

import { Banner, Button } from '@/components/admin/ui';
import { findMissingOrders } from '@/lib/admin/actions/recover';
import type { RecoverResult } from '@/lib/commerce/recover-orders';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

/**
 * Pulls in orders that were paid on Stripe but never recorded here — what
 * happens when the webhook is misconfigured or Stripe can't reach the site.
 */
export function RecoverOrdersButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<RecoverResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              setResult(null);
              const res = await findMissingOrders();
              if (!res.ok) return setError(res.error);
              setResult(res.data);
              if (res.data.created) router.refresh();
            })
          }
        >
          {pending ? 'Checking Stripe…' : 'Check Stripe for missing orders'}
        </Button>
      </div>
      {error && <Banner tone="critical">{error}</Banner>}
      {result && (
        <Banner
          tone={result.failed.length ? 'warning' : result.created ? 'success' : 'info'}
          title={
            result.created
              ? `${result.created} order${result.created === 1 ? '' : 's'} brought in from Stripe`
              : 'No missing orders'
          }
        >
          Checked {result.checked} paid payment{result.checked === 1 ? '' : 's'} from the last 14 days;{' '}
          {result.alreadyThere} {result.alreadyThere === 1 ? 'was' : 'were'} already here.
          {result.created > 0 && ' Confirmation emails were sent for the new ones.'}
          {result.failed.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {result.failed.slice(0, 10).map((f) => (
                <li key={f.session}>
                  <code>{f.session}</code>: {f.reason}
                </li>
              ))}
            </ul>
          )}
          {result.created === 0 && result.failed.length === 0 && result.checked === 0 && (
            <> Stripe shows no paid payments in that period — check you’re using the same Stripe mode (test or live) as the payment.</>
          )}
        </Banner>
      )}
    </div>
  );
}
