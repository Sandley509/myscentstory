import { Breadcrumbs } from '@/components/store/breadcrumbs';
import { EmbeddedCheckoutForm } from '@/components/store/embedded-checkout';
import { startCheckout } from '@/lib/commerce/checkout';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };

/**
 * Checkout, inside the store's own layout.
 *
 * Stripe's form is embedded here, so the shopper stays on the site. Without
 * NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY there is nothing to mount the form with,
 * so we fall back to Stripe's hosted page rather than showing a broken step.
 */
export default async function CheckoutPage() {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const result = await startCheckout({ embedded: Boolean(publishableKey) });

  if (!result.ok) {
    redirect(`/?checkout_error=${encodeURIComponent(result.error)}`);
  }
  if (result.mode === 'hosted') {
    redirect(result.url);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6">
      <Breadcrumbs trail={[{ name: 'Checkout', path: '/checkout' }]} />
      <h1 className="heading-caps mt-4 text-2xl lg:text-3xl">Checkout</h1>
      <p className="mt-2 text-sm text-muted">
        Payment is handled by Stripe. Your card details go straight to them and never touch our servers.
      </p>
      <div className="mt-8">
        <EmbeddedCheckoutForm clientSecret={result.clientSecret} publishableKey={publishableKey!} />
      </div>
      <p className="mt-8 text-sm text-muted">
        Changed your mind?{' '}
        <Link href="/collections/all" className="font-semibold text-ink underline">
          Keep shopping
        </Link>{' '}
        — nothing is charged until you pay.
      </p>
    </div>
  );
}
