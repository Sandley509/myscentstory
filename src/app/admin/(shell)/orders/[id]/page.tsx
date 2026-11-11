import { CommentBox, FulfillButton, OrderHeaderActions, OrderNote, TrackingCard, type TrackingEventView } from '@/components/admin/order-client';
import { trackingLink } from '@/lib/commerce/order-link';
import { Badge, Card, CardSection, Layout, Page, Thumbnail } from '@/components/admin/ui';
import { requireStaffPage } from '@/lib/admin/auth';
import {
  customerName,
  financialBadge,
  formatAddress,
  formatDate,
  formatMoney,
  fulfillmentBadge,
  orderStatusBadge
} from '@/lib/admin/format';
import type { CustomerRow, OrderEventRow, OrderLineItemRow, OrderRow } from '@/lib/commerce/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await requireStaffPage();
  const { data } = await supabase.from('orders').select('order_number').eq('id', id).maybeSingle();
  return { title: data ? `Order #${data.order_number}` : 'Order' };
}

const isUrl = (v: string) => /^https?:\/\//i.test(v);
const isImageUrl = (v: string) => isUrl(v) && /\.(jpe?g|png|webp|gif|heic)(\?|$)/i.test(v);

export default async function OrderPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, staff } = await requireStaffPage();

  const [{ data: orderData }, { data: itemsData }, { data: eventsData }, { data: trackingData, error: trackingError }] = await Promise.all([
    supabase.from('orders').select('*').eq('id', id).maybeSingle(),
    supabase.from('order_line_items').select('*').eq('order_id', id),
    supabase.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    supabase.from('order_tracking_events').select('*').eq('order_id', id).order('created_at', { ascending: false })
  ]);
  if (!orderData) notFound();

  const order = orderData as OrderRow;
  const items = (itemsData ?? []) as OrderLineItemRow[];
  const events = (eventsData ?? []) as OrderEventRow[];

  let customer: CustomerRow | null = null;
  let customerOrders = 0;
  if (order.customer_id) {
    const [{ data: c }, { data: stats }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', order.customer_id).maybeSingle(),
      supabase.from('customer_stats').select('orders_count').eq('id', order.customer_id).maybeSingle()
    ]);
    customer = c as CustomerRow | null;
    customerOrders = Number(stats?.orders_count ?? 0);
  }

  const cur = order.currency;
  const fin = financialBadge[order.financial_status];
  const ful = fulfillmentBadge[order.fulfillment_status];
  const st = orderStatusBadge[order.status];
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const refundable = Math.max(0, Number(order.total) - Number(order.refunded_total));
  const netPaid = order.financial_status === 'pending' || order.financial_status === 'voided' ? 0 : Number(order.total) - Number(order.refunded_total);
  const staffInitials = (staff.name || staff.email).slice(0, 2).toUpperCase();

  return (
    <Page
      backHref="/admin/orders"
      title={<span className={order.status === 'cancelled' ? 'line-through' : ''}>#{order.order_number}</span>}
      titleMeta={
        <>
          <Badge tone={fin.tone} dot={fin.dot}>{fin.label}</Badge>
          <Badge tone={ful.tone} dot={ful.dot}>{ful.label}</Badge>
          {st && <Badge tone={st.tone}>{st.label}</Badge>}
        </>
      }
      subtitle={`${formatDate(order.created_at)} from Online Store`}
      secondaryActions={
        <OrderHeaderActions
          orderId={order.id}
          status={order.status}
          financialStatus={order.financial_status}
          refundable={refundable}
          currency={cur}
        />
      }
    >
      <Layout
        main={
          <>
            <Card
              title={
                <span className="flex items-center gap-2">
                  <Badge tone={ful.tone} dot={ful.dot}>{ful.label}</Badge>
                  <span className="text-admin-subdued">({itemCount})</span>
                </span>
              }
              flush
            >
              <div className="mt-3 border-t border-admin-border">
                {items.map((li) => (
                  <div key={li.id} className="flex gap-3 border-b border-admin-border px-4 py-3 last:border-b-0">
                    <Thumbnail src={li.image_url} />
                    <div className="min-w-0 flex-1">
                      {li.product_id ? (
                        <Link href={`/admin/products/${li.product_id}`} className="font-medium text-admin-link hover:underline">
                          {li.title}
                        </Link>
                      ) : (
                        <span className="font-medium">{li.title}</span>
                      )}
                      {li.variant_title && (
                        <div className="mt-0.5">
                          <Badge>{li.variant_title}</Badge>
                        </div>
                      )}
                      {li.sku && <div className="text-admin-subdued">SKU: {li.sku}</div>}
                      {li.attributes?.length > 0 && (
                        <dl className="mt-1.5 flex flex-col gap-1 rounded-lg bg-[#f7f7f7] p-2">
                          {li.attributes.map((a) => (
                            <div key={a.key} className="flex flex-wrap gap-x-2">
                              <dt className="text-admin-subdued">{a.key}:</dt>
                              <dd className="min-w-0 break-words">
                                {isImageUrl(a.value) ? (
                                  <a href={a.value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-admin-link hover:underline">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={a.value} alt={a.key} className="h-12 w-12 rounded-md border border-admin-border object-cover" />
                                    Open file
                                  </a>
                                ) : isUrl(a.value) ? (
                                  <a href={a.value} target="_blank" rel="noreferrer" className="text-admin-link hover:underline">
                                    {a.value}
                                  </a>
                                ) : (
                                  a.value
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                    <div className="whitespace-nowrap text-right text-admin-subdued">
                      {formatMoney(li.price, cur)} × {li.quantity}
                    </div>
                    <div className="w-20 whitespace-nowrap text-right">{formatMoney(Number(li.price) * li.quantity, cur)}</div>
                  </div>
                ))}
              </div>
              {order.status !== 'cancelled' && (
                <div className="flex items-center justify-between gap-2 border-t border-admin-border px-4 py-3">
                  <div className="text-admin-subdued">
                    {order.tracking_number &&
                      (order.tracking_url ? (
                        <a href={order.tracking_url} target="_blank" rel="noreferrer" className="text-admin-link hover:underline">
                          Tracking {order.tracking_number}
                        </a>
                      ) : (
                        `Tracking ${order.tracking_number}`
                      ))}
                  </div>
                  <FulfillButton
                    orderId={order.id}
                    fulfilled={order.fulfillment_status === 'fulfilled'}
                    disabled={order.financial_status === 'pending'}
                  />
                </div>
              )}
            </Card>

            {order.status !== 'cancelled' && (
              <Card title="Shipment tracking">
                <TrackingCard
                  orderId={order.id}
                  status={order.shipment_status ?? 'confirmed'}
                  carrier={order.carrier ?? null}
                  trackingNumber={order.tracking_number}
                  trackingUrl={order.tracking_url}
                  estimatedDelivery={order.estimated_delivery ?? null}
                  events={(trackingData ?? []) as TrackingEventView[]}
                  customerUrl={trackingLink(order)}
                  confirmationSentAt={order.confirmation_email_sent_at ?? null}
                  hasEmail={!!order.email}
                  migrationNeeded={!!trackingError}
                />
              </Card>
            )}

            <Card title={<Badge tone={fin.tone} dot={fin.dot}>{fin.label}</Badge>}>
              <dl className="grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-1.5">
                <dt>Subtotal</dt>
                <dd className="text-admin-subdued">{itemCount} item{itemCount === 1 ? '' : 's'}</dd>
                <dd className="text-right">{formatMoney(order.subtotal, cur)}</dd>

                {Number(order.discount_total) > 0 && (
                  <>
                    <dt>Discount</dt>
                    <dd className="text-admin-subdued">{order.discount_code}</dd>
                    <dd className="text-right">−{formatMoney(order.discount_total, cur)}</dd>
                  </>
                )}
                <dt>Shipping</dt>
                <dd className="text-admin-subdued">{Number(order.shipping_total) === 0 ? 'Free' : 'Standard'}</dd>
                <dd className="text-right">{formatMoney(order.shipping_total, cur)}</dd>

                <dt>Taxes</dt>
                <dd />
                <dd className="text-right">{formatMoney(order.tax_total, cur)}</dd>

                <dt className="font-semibold">Total</dt>
                <dd />
                <dd className="text-right font-semibold">{formatMoney(order.total, cur)}</dd>
              </dl>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-y-1.5 border-t border-admin-border pt-3">
                {Number(order.refunded_total) > 0 && (
                  <>
                    <span>Refunded</span>
                    <span className="text-right">−{formatMoney(order.refunded_total, cur)}</span>
                  </>
                )}
                <span>{order.financial_status === 'pending' ? 'Balance due' : 'Net payment'}</span>
                <span className="text-right">
                  {formatMoney(order.financial_status === 'pending' ? order.total : netPaid, cur)}
                </span>
              </div>
              {order.stripe_payment_intent_id && (
                <p className="mt-3 text-admin-subdued">
                  Stripe payment{' '}
                  <a
                    href={`https://dashboard.stripe.com/payments/${order.stripe_payment_intent_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-admin-link hover:underline"
                  >
                    {order.stripe_payment_intent_id}
                  </a>
                </p>
              )}
            </Card>

            <div>
              <h2 className="mb-2 px-1 text-[13px] font-semibold">Timeline</h2>
              <CommentBox orderId={order.id} initials={staffInitials} />
              <ol className="relative ml-4 mt-2 border-l-2 border-admin-border pl-5">
                {events.map((e) => (
                  <li key={e.id} className="relative py-2">
                    <span className="absolute -left-[27px] top-3 h-3 w-3 rounded-full border-2 border-admin-bg bg-[#b5b5b5]" />
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      {e.kind === 'comment' ? (
                        <div className="admin-card flex-1 px-3 py-2">
                          <div className="text-[12px] font-semibold">{e.author}</div>
                          <p className="whitespace-pre-wrap">{e.message}</p>
                        </div>
                      ) : (
                        <p className="flex-1">{e.message}</p>
                      )}
                      <time className="whitespace-nowrap text-[12px] text-admin-subdued">{formatDate(e.created_at)}</time>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </>
        }
        aside={
          <>
            <Card>
              <OrderNote orderId={order.id} note={order.note} />
            </Card>

            <Card title="Customer" flush>
              <div className="px-4 pb-3 pt-2">
                {customer ? (
                  <>
                    <Link href={`/admin/customers/${customer.id}`} className="font-medium text-admin-link hover:underline">
                      {customerName(customer)}
                    </Link>
                    <p className="text-admin-subdued">
                      {customerOrders} order{customerOrders === 1 ? '' : 's'}
                    </p>
                  </>
                ) : (
                  <p className="text-admin-subdued">No customer</p>
                )}
              </div>
              <CardSection>
                <h3 className="mb-1 font-semibold">Contact information</h3>
                {order.email ? (
                  <a href={`mailto:${order.email}`} className="block truncate text-admin-link hover:underline">
                    {order.email}
                  </a>
                ) : (
                  <p className="text-admin-subdued">No email provided</p>
                )}
                <p className="text-admin-subdued">{order.phone ?? 'No phone number'}</p>
              </CardSection>
              <CardSection>
                <h3 className="mb-1 font-semibold">Shipping address</h3>
                {order.shipping_address ? (
                  <address className="not-italic">
                    {formatAddress(order.shipping_address).map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </address>
                ) : (
                  <p className="text-admin-subdued">No shipping address</p>
                )}
              </CardSection>
              <CardSection>
                <h3 className="mb-1 font-semibold">Billing address</h3>
                {order.billing_address &&
                JSON.stringify(order.billing_address) !== JSON.stringify(order.shipping_address) ? (
                  <address className="not-italic">
                    {formatAddress(order.billing_address).map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </address>
                ) : (
                  <p className="text-admin-subdued">Same as shipping address</p>
                )}
              </CardSection>
            </Card>
          </>
        }
      />
    </Page>
  );
}
