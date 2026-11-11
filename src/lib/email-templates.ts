import 'server-only';

import type { Address, OrderLineItemRow, OrderRow, TrackingEventRow } from './commerce/db';
import { countryName } from './countries';
import { formatMoney } from './currency';
import { absoluteUrl, SITE } from './site';
import { carrierName, estimatedWindow, formatDay, STATUS_INFO } from './tracking';

/**
 * Order emails. Table layout with inline styles: the only thing that renders
 * reliably across Gmail, Outlook and Apple Mail.
 */
const PLUM = '#5b0043';
const esc = (s: string | number | null | undefined) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Base = { storeName: string; supportEmail: string; trackUrl: string };

function layout(b: Base, preheader: string, content: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(b.storeName)}</title></head>
<body style="margin:0;padding:0;background:#f4f1f2;font-family:Helvetica,Arial,sans-serif;color:#0a0a0a">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1f2;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff">
<tr><td align="center" style="padding:28px 24px 20px;border-bottom:1px solid #e4e0e2">
<a href="${absoluteUrl('/')}"><img src="${absoluteUrl('/logo.png')}" width="180" alt="${esc(b.storeName)}" style="display:block;width:180px;height:auto;border:0"></a></td></tr>
<tr><td style="padding:32px 32px 8px">${content}</td></tr>
<tr><td style="padding:24px 32px 32px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${PLUM}">
<a href="${b.trackUrl}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none">Track your order</a>
</td></tr></table></td></tr>
<tr><td style="padding:20px 32px;background:#0a0a0a;color:#bdbdbd;font-size:12px;line-height:18px">
Questions? Reply to this email or write to <a href="mailto:${esc(b.supportEmail)}" style="color:#ffffff">${esc(b.supportEmail)}</a>.<br>
${esc(SITE.legalName)} · <a href="${absoluteUrl('/pages/shipping')}" style="color:#bdbdbd">Shipping</a> · <a href="${absoluteUrl('/pages/returns')}" style="color:#bdbdbd">Returns</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

const h1 = (t: string) => `<h1 style="margin:0 0 12px;font-size:22px;letter-spacing:1px;text-transform:uppercase">${esc(t)}</h1>`;
const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:23px;color:#333333">${t}</p>`;

function addressLines(a: Address | null): string[] {
  if (!a) return [];
  return [a.name, a.line1, a.line2, [a.city, a.state, a.postal_code].filter(Boolean).join(', '), a.country ? countryName(a.country) : null].filter(
    Boolean
  ) as string[];
}

function firstName(order: OrderRow): string {
  const n = order.shipping_address?.name?.trim().split(/\s+/)[0];
  return n ? `, ${n}` : '';
}

function itemsTable(order: OrderRow, items: OrderLineItemRow[]) {
  const cur = order.currency;
  const m = (n: number | string) => esc(formatMoney(Number(n), cur));
  const rows = items
    .map(
      (li) => `<tr>
<td width="64" style="padding:10px 0;border-bottom:1px solid #eeeeee">${
        li.image_url?.startsWith('https://')
          ? `<img src="${esc(li.image_url)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;object-fit:cover;background:#f4f1f2">`
          : ''
      }</td>
<td style="padding:10px 12px;border-bottom:1px solid #eeeeee;font-size:14px;line-height:20px"><strong>${esc(li.title)}</strong>${
        li.variant_title ? `<br><span style="color:#6f6a6d">${esc(li.variant_title)}</span>` : ''
      }<br><span style="color:#6f6a6d">Qty ${li.quantity}</span></td>
<td align="right" style="padding:10px 0;border-bottom:1px solid #eeeeee;font-size:14px;white-space:nowrap">${m(Number(li.price) * li.quantity)}</td></tr>`
    )
    .join('');
  const line = (label: string, value: string, bold = false) =>
    `<tr><td colspan="2" style="padding:4px 0;font-size:14px;${bold ? 'font-weight:bold' : 'color:#555555'}">${label}</td><td align="right" style="padding:4px 0;font-size:14px;${bold ? 'font-weight:bold' : ''}">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">${rows}
${line('Subtotal', m(order.subtotal))}
${Number(order.discount_total) > 0 ? line(`Discount${order.discount_code ? ` (${esc(order.discount_code)})` : ''}`, `−${m(order.discount_total)}`) : ''}
${line('Shipping', Number(order.shipping_total) === 0 ? 'Free' : m(order.shipping_total))}
${Number(order.tax_total) > 0 ? line('Taxes', m(order.tax_total)) : ''}
${line('Total', `${m(order.total)} ${esc(cur)}`, true)}
</table>`;
}

export function orderConfirmationEmail(b: Base, order: OrderRow, items: OrderLineItemRow[]) {
  const { start, end } = estimatedWindow(order.created_at, SITE.shipping.handlingDays, SITE.shipping.transitDays);
  const ship = addressLines(order.shipping_address);
  const subject = `Order #${order.order_number} confirmed`;
  const html = layout(
    b,
    `Thank you for your order. Estimated delivery ${formatDay(start)} to ${formatDay(end)}.`,
    `${h1('Thank you for your order')}
${p(`Hi${esc(firstName(order))}, we’ve received your order <strong>#${order.order_number}</strong> and we’re getting it ready. We’ll email you again when it ships, with your tracking number.`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#f4f1f2"><tr>
<td style="padding:14px 16px;font-size:13px;line-height:20px"><span style="color:#6f6a6d;text-transform:uppercase;letter-spacing:1px;font-size:11px">Estimated delivery</span><br><strong>${esc(formatDay(start))} – ${esc(formatDay(end))}</strong></td>
<td style="padding:14px 16px;font-size:13px;line-height:20px"><span style="color:#6f6a6d;text-transform:uppercase;letter-spacing:1px;font-size:11px">Order date</span><br><strong>${esc(formatDay(order.created_at))}</strong></td>
</tr></table>
${itemsTable(order, items)}
${ship.length ? `<h2 style="margin:24px 0 6px;font-size:13px;letter-spacing:1px;text-transform:uppercase">Shipping to</h2>${p(ship.map(esc).join('<br>'))}` : ''}`
  );
  const text = [
    `Thank you for your order #${order.order_number}.`,
    `Estimated delivery: ${formatDay(start)} to ${formatDay(end)}.`,
    '',
    ...items.map((li) => `${li.quantity} × ${li.title}${li.variant_title ? ` (${li.variant_title})` : ''}: ${formatMoney(Number(li.price) * li.quantity, order.currency)}`),
    `Total: ${formatMoney(Number(order.total), order.currency)} ${order.currency}`,
    '',
    `Track your order: ${b.trackUrl}`,
    `Questions: ${b.supportEmail}`
  ].join('\n');
  return { subject, html, text };
}

export function shippingUpdateEmail(b: Base, order: OrderRow, event: TrackingEventRow, items: OrderLineItemRow[]) {
  const info = STATUS_INFO[event.status];
  const subjects: Partial<Record<TrackingEventRow['status'], string>> = {
    shipped: `Your order #${order.order_number} is on its way`,
    out_for_delivery: `Your order #${order.order_number} is out for delivery`,
    delivered: `Your order #${order.order_number} was delivered`,
    exception: `An update about your order #${order.order_number}`
  };
  const subject = subjects[event.status] ?? `Order #${order.order_number}: ${info.label}`;
  const carrier = carrierName(order.carrier);
  const trackingBlock = order.tracking_number
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#f4f1f2"><tr><td style="padding:14px 16px;font-size:14px;line-height:21px">
${carrier ? `<span style="color:#6f6a6d">Carrier:</span> <strong>${esc(carrier)}</strong><br>` : ''}
<span style="color:#6f6a6d">Tracking number:</span> ${
        order.tracking_url
          ? `<a href="${esc(order.tracking_url)}" style="color:${PLUM};font-weight:bold">${esc(order.tracking_number)}</a>`
          : `<strong>${esc(order.tracking_number)}</strong>`
      }${order.estimated_delivery ? `<br><span style="color:#6f6a6d">Estimated delivery:</span> <strong>${esc(formatDay(order.estimated_delivery))}</strong>` : ''}
</td></tr></table>`
    : '';
  const html = layout(
    b,
    `${info.label}: order #${order.order_number}`,
    `${h1(info.label)}
${p(`Hi${esc(firstName(order))}, ${esc(info.customer.charAt(0).toLowerCase() + info.customer.slice(1))}`)}
${event.message ? p(esc(event.message)) : ''}
${event.location ? p(`<span style="color:#6f6a6d">Location:</span> ${esc(event.location)}`) : ''}
${trackingBlock}
<h2 style="margin:24px 0 6px;font-size:13px;letter-spacing:1px;text-transform:uppercase">In this order</h2>
${p(items.map((li) => `${li.quantity} × ${esc(li.title)}${li.variant_title ? ` (${esc(li.variant_title)})` : ''}`).join('<br>'))}`
  );
  const text = [
    `${info.label}: order #${order.order_number}`,
    info.customer,
    event.message ?? '',
    order.tracking_number ? `Tracking: ${carrier ? `${carrier} ` : ''}${order.tracking_number}${order.tracking_url ? ` ${order.tracking_url}` : ''}` : '',
    `Track your order: ${b.trackUrl}`,
    `Questions: ${b.supportEmail}`
  ]
    .filter(Boolean)
    .join('\n');
  return { subject, html, text };
}
