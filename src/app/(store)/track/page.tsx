import { Breadcrumbs } from '@/components/store/breadcrumbs';
import { getStoreSettings } from '@/lib/commerce';
import { loadTrackedOrder } from '@/lib/commerce/track-lookup';
import { countryName } from '@/lib/countries';
import { SITE } from '@/lib/site';
import { carrierName, estimatedWindow, formatDateTime, formatDay, PROGRESS_STEPS, progressIndex, STATUS_INFO } from '@/lib/tracking';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { LookupForm } from './lookup-form';

export const metadata: Metadata = {
  title: 'Track your order',
  description: 'Track your MyScentStory order with your order number and email.',
  alternates: { canonical: '/track' },
  // Individual order pages must never be indexed.
  robots: { index: false, follow: true }
};
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ order?: string; t?: string }> };

export default async function TrackPage({ searchParams }: Props) {
  const { order: orderParam, t } = await searchParams;
  const [order, settings] = await Promise.all([loadTrackedOrder(orderParam, t).catch(() => null), getStoreSettings()]);
  const support = settings.contact_email || SITE.supportEmail;

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <Breadcrumbs trail={[{ name: 'Track your order', path: '/track' }]} />
        <h1 className="heading-caps mt-8 text-3xl">Track your order</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Enter your order number and the email you used at checkout to see where your perfume is.
        </p>
        <LookupForm notice={orderParam ? 'That tracking link has expired or is incomplete. Look up your order below.' : undefined} />
        <p className="mt-10 text-sm text-muted">
          Need help? <a href={`mailto:${support}`} className="underline">{support}</a>
        </p>
      </div>
    );
  }

  const step = progressIndex(order.status);
  const info = STATUS_INFO[order.status];
  const window = estimatedWindow(order.placedAt, SITE.shipping.handlingDays, SITE.shipping.transitDays);
  const carrier = carrierName(order.carrier);
  const destination = order.destination
    ?.split(', ')
    .map((part) => (/^[A-Z]{2}$/.test(part) ? countryName(part) : part))
    .join(', ');

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs trail={[{ name: 'Track your order', path: '/track' }]} />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-muted">Order #{order.number}</p>
          <h1 className="heading-caps mt-2 text-3xl">{order.cancelled ? 'Order cancelled' : info.label}</h1>
          <p className="mt-2 text-sm text-muted">{order.cancelled ? 'This order was cancelled. Any payment has been refunded.' : info.customer}</p>
        </div>
        <p className="text-sm text-muted">Placed {formatDay(order.placedAt)}</p>
      </div>

      {!order.cancelled && (
        <>
          {/* Progress */}
          <ol className="mt-8 grid grid-cols-5 gap-1" aria-label="Order progress">
            {PROGRESS_STEPS.map((s, i) => (
              <li key={s} aria-current={i === step ? 'step' : undefined} className="text-center">
                <div className={`h-1.5 ${i <= step ? (order.status === 'exception' && i === step ? 'bg-danger' : 'bg-brand-600') : 'bg-line'}`} />
                <p className={`mt-2 text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] sm:text-[11px] ${i <= step ? 'text-fg' : 'text-muted'}`}>
                  {STATUS_INFO[s].label}
                </p>
              </li>
            ))}
          </ol>

          {order.status === 'exception' && (
            <p role="alert" className="mt-6 border border-danger/40 bg-danger/5 px-4 py-3 text-sm">
              There’s a delivery issue with this order. We’re working on it; if you have questions, write to{' '}
              <a href={`mailto:${support}`} className="underline">{support}</a> with your order number.
            </p>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="bg-surface p-5">
              <p className="eyebrow text-muted">Estimated delivery</p>
              <p className="mt-2 font-semibold">
                {order.status === 'delivered'
                  ? 'Delivered'
                  : order.estimatedDelivery
                    ? formatDay(order.estimatedDelivery)
                    : `${formatDay(window.start)} – ${formatDay(window.end)}`}
              </p>
            </div>
            <div className="bg-surface p-5">
              <p className="eyebrow text-muted">Carrier</p>
              {order.trackingNumber ? (
                <>
                  <p className="mt-2 font-semibold">{carrier ?? 'Carrier'}</p>
                  {order.trackingUrl ? (
                    <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-sm text-brand-600 underline">
                      {order.trackingNumber}
                    </a>
                  ) : (
                    <p className="mt-1 break-all text-sm">{order.trackingNumber}</p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">Tracking number coming when your order ships.</p>
              )}
            </div>
            <div className="bg-surface p-5">
              <p className="eyebrow text-muted">Shipping to</p>
              <p className="mt-2 font-semibold">{destination ?? '—'}</p>
            </div>
          </div>
        </>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="updates-heading">
          <h2 id="updates-heading" className="text-[11px] font-bold uppercase tracking-[0.14em]">
            Updates
          </h2>
          {order.events.length ? (
            <ol className="mt-4 border-l-2 border-line pl-5">
              {order.events.map((e, i) => (
                <li key={i} className="relative pb-6 last:pb-0">
                  <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ${i === 0 ? 'bg-brand-600' : 'bg-line'}`} />
                  <p className="text-sm font-semibold">{STATUS_INFO[e.status].label}</p>
                  {(e.message || e.location) && (
                    <p className="text-sm text-muted">{[e.message, e.location].filter(Boolean).join(' · ')}</p>
                  )}
                  <time className="text-xs text-muted">{formatDateTime(e.at)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-muted">No updates yet.</p>
          )}
        </section>

        <section aria-labelledby="items-heading">
          <h2 id="items-heading" className="text-[11px] font-bold uppercase tracking-[0.14em]">
            In this order
          </h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {order.items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <div className="relative h-14 w-14 shrink-0 bg-surface">
                  {item.image && <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />}
                </div>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-muted">
                    {[item.variant, `Qty ${item.quantity}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted">
            Questions about this order? Email <a href={`mailto:${support}`} className="underline">{support}</a> with order #{order.number}.
          </p>
          <p className="mt-3 text-sm">
            <Link href="/track" className="underline">Track another order</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
