/**
 * Store pages: shipping, returns, privacy, terms, contact, about.
 *
 * Google Merchant Center and Meta both check that a shop shows its shipping
 * costs, return policy and a way to contact the business before approving it.
 * The figures below come from /admin → Settings and `src/lib/site.ts`, so the
 * pages always match what checkout actually charges.
 *
 * These are starting templates, not legal advice: read each one and adjust
 * it to how the business really operates before launch.
 */
import type { StoreSettingsRow } from './commerce/db';
import { toNumber } from './commerce/pricing';
import { SITE } from './site';
import { countryName, shipsWorldwide, checkoutCountries } from './countries';
import { formatPrice } from './utils';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const PAGE_SLUGS = ['about', 'contact', 'shipping', 'returns', 'privacy', 'terms'] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

export type StorePage = { title: string; description: string; updated?: string; body: ReactNode };

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** Bump when you change a policy; shown as "Last updated" on the page. */
const POLICY_DATE = 'November 11, 2026';

export function getStorePage(slug: string, settings: StoreSettingsRow): StorePage | undefined {
  const name = settings.store_name || SITE.name;
  const legal = SITE.legalName;
  const email = settings.contact_email || SITE.supportEmail;
  const mail = <a href={`mailto:${email}`}>{email}</a>;
  const cur = settings.currency;
  const money = (n: number) => `${formatPrice(n, cur)} ${cur}`;
  const flat = toNumber(settings.shipping_flat_rate);
  const threshold = toNumber(settings.free_shipping_threshold);
  const worldwide = shipsWorldwide(settings);
  const destinations = worldwide ? 'worldwide' : `to ${list(checkoutCountries(settings).map((c) => countryName(c)))}`;
  const [hMin, hMax] = SITE.shipping.handlingDays;
  const [tMin, tMax] = SITE.shipping.transitDays;
  const minDays = hMin + tMin;
  const maxDays = hMax + tMax;
  const { days, paidBy, damageReportDays } = SITE.returns;
  const address = settings.address ?? {};
  const addressLines = [address.line1, address.line2, [address.city, address.state, address.postal_code].filter(Boolean).join(', '), address.country && countryName(address.country)].filter(Boolean) as string[];
  const shippingLine =
    flat > 0
      ? `Standard shipping is ${money(flat)} per order${threshold > 0 ? `, and free on orders of ${money(threshold)} or more` : ''}.`
      : 'Shipping is free on every order.';

  switch (slug as PageSlug) {
    case 'about':
      return {
        title: 'Our story',
        description: `About ${name}: an online perfume shop for women's and men's fragrances, shipping ${destinations}.`,
        body: (
          <>
            <p>
              {name} is an online perfume shop. We bring together eau de parfum, eau de toilette and gift sets for her
              and for him, with clear notes and sizes so choosing a scent online is simple.
            </p>
            <p>
              Every listing shows the top, heart and base notes, the concentration and the bottle size, so you know
              what you are getting before it arrives. We ship {destinations}.
            </p>
            <p>
              Questions about a fragrance or an order? <Link href="/pages/contact">Get in touch</Link>.
            </p>
          </>
        )
      };

    case 'contact':
      return {
        title: 'Contact us',
        description: `Contact ${name} customer support at ${email}. We reply ${SITE.supportReplyTime}.`,
        body: (
          <>
            <p>
              Questions about an order, a return or which fragrance to choose? Our support team is happy to help.
            </p>
            <div className="not-prose my-8 border border-line bg-surface p-6">
              <p className="eyebrow text-brand-600">Email support</p>
              <p className="mt-2 text-xl font-semibold">
                <a href={`mailto:${email}`} className="hover:text-brand-600">{email}</a>
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold">Support hours</dt>
                  <dd className="text-muted">{SITE.supportHours}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Response time</dt>
                  <dd className="text-muted">We reply {SITE.supportReplyTime}</dd>
                </div>
                {settings.phone && (
                  <div>
                    <dt className="font-semibold">Phone</dt>
                    <dd className="text-muted">
                      <a href={`tel:${settings.phone.replace(/[^+\d]/g, '')}`}>{settings.phone}</a>
                    </dd>
                  </div>
                )}
                {addressLines.length > 0 && (
                  <div>
                    <dt className="font-semibold">Address</dt>
                    <dd className="text-muted">{legal}, {addressLines.join(', ')}</dd>
                  </div>
                )}
              </dl>
            </div>
            <h2>To help us answer faster</h2>
            <ul>
              <li>Include your order number (it starts with # and is in your confirmation email).</li>
              <li>For a damaged or wrong item, attach a photo of the bottle and the box.</li>
              <li>Write from the email address you used to order, if you can.</li>
            </ul>
            <h2>Quick answers</h2>
            <ul>
              <li>Where is my order? <Link href="/track">Track your order</Link> with your order number and email.</li>
              <li>How long does delivery take? {minDays} to {maxDays} days. See <Link href="/pages/shipping">Shipping</Link>.</li>
              <li>Can I return a perfume? Yes, unopened within {days} days. See <Link href="/pages/returns">Returns &amp; refunds</Link>.</li>
            </ul>
          </>
        )
      };

    case 'shipping':
      return {
        title: 'Shipping policy',
        updated: POLICY_DATE,
        description: `${name} ships ${destinations}. ${shippingLine} Delivery in ${minDays} to ${maxDays} days.`,
        body: (
          <>
            <h2>Where we ship</h2>
            <p>
              We ship {destinations}.{' '}
              {worldwide && 'If your country isn’t offered at checkout, email us and we’ll see what we can do.'}
            </p>
            <h2>Shipping rates</h2>
            <p>
              {shippingLine} The free-shipping amount is counted after discounts and before taxes. The exact cost is
              always shown at checkout before you pay.
            </p>
            <h2>Delivery time</h2>
            <p>
              Orders arrive in <strong>{minDays} to {maxDays} days</strong>: we prepare your order within {hMin} to {hMax}{' '}
              business days, then the carrier delivers it. Remote areas, customs checks, holidays and peak seasons can
              add a few days.
            </p>
            <h2>Tracking your order</h2>
            <p>
              You get a confirmation email as soon as you order, and another with your tracking number when it ships.
              You can follow it any time on the <Link href="/track">Track your order</Link> page with your order number
              and email.
            </p>
            <h2>Customs, duties and taxes</h2>
            <p>
              International orders may be charged import duties, taxes or customs fees by the destination country.
              These are set by local authorities, are not included in our prices or shipping, and are paid by the
              recipient when the parcel arrives. Parcels refused because of these fees are returned to us; we refund
              the items once they arrive, minus the original shipping and any return costs.
            </p>
            <h2>Address and delivery problems</h2>
            <ul>
              <li>Please check your address at checkout. If you spot a mistake, email {mail} right away; we can change it before the order ships.</li>
              <li>If tracking shows “delivered” but you can’t find the parcel, check with neighbours and your local post office, then contact us within {damageReportDays} days.</li>
              <li>If a parcel is lost in transit, we open a claim with the carrier and send a replacement or a refund.</li>
            </ul>
            <h2>Fragrance and air shipping</h2>
            <p>
              Perfume contains alcohol and is classed as a limited-quantity dangerous good for transport, so some
              destinations can only be reached by ground or sea services. This is already included in the delivery
              time above.
            </p>
          </>
        )
      };

    case 'returns':
      return {
        title: 'Returns & refunds',
        updated: POLICY_DATE,
        description: `${name} return policy: ${days}-day returns on unopened perfumes, free replacement of damaged items, refunds to your original payment method.`,
        body: (
          <>
            <p>
              We want you to love your fragrance. If something isn’t right, here is how returns and refunds work.
            </p>
            <h2>{days}-day returns</h2>
            <p>
              You can return an item within <strong>{days} days of delivery</strong> if it is:
            </p>
            <ul>
              <li>unopened and unused, with the cellophane or seal intact;</li>
              <li>in its original box and packaging, in resellable condition.</li>
            </ul>
            <h2>Items we can’t take back</h2>
            <p>For hygiene and safety reasons we can’t accept returns of:</p>
            <ul>
              <li>perfumes that have been opened, sprayed or tested, or whose seal is broken;</li>
              <li>gift sets once opened;</li>
              <li>samples, miniatures and free gifts;</li>
              <li>items marked “final sale”.</li>
            </ul>
            <h2>Damaged, leaking or wrong items</h2>
            <p>
              If your order arrives damaged, leaking or isn’t what you ordered, email {mail} within{' '}
              <strong>{damageReportDays} days of delivery</strong> with your order number and photos of the item and
              the box. We’ll send a replacement or a full refund, including shipping, at no cost to you, and you won’t
              need to send anything back unless we ask.
            </p>
            <h2>How to start a return</h2>
            <ol>
              <li>Email {mail} with your order number and the item you want to return.</li>
              <li>We reply with the return address and instructions, usually within one business day.</li>
              <li>
                Pack the item securely and send it back with a tracked service. Please don’t send a return without
                contacting us first: unannounced parcels can’t always be matched to an order.
              </li>
            </ol>
            <h2>Return shipping costs</h2>
            <p>
              {paidBy === 'store'
                ? 'Return shipping is free.'
                : 'Return shipping is paid by the customer, unless the item arrived damaged, defective or wrong.'}{' '}
              The original shipping charge isn’t refunded, except when the return is our mistake. For international
              returns, any duties or taxes charged by your country can’t be refunded by us.
            </p>
            <h2>Refunds</h2>
            <p>
              Once your return arrives and is checked, we email you and refund the item price to your original payment
              method within 5 business days. Your bank may take another 5 to 10 business days to show it. Refunds are
              made in {cur}, the currency you were charged in, so the amount in your own currency can differ slightly
              because of exchange rates.
            </p>
            <h2>Exchanges</h2>
            <p>
              The quickest way to swap a fragrance or size is to return the unopened item for a refund and place a new
              order.
            </p>
            <h2>Cancelling an order</h2>
            <p>
              You can cancel for a full refund any time before your order ships: email {mail} as soon as possible. Once
              it has shipped, the return policy above applies.
            </p>
          </>
        )
      };

    case 'privacy':
      return {
        title: 'Privacy policy',
        updated: POLICY_DATE,
        description: `How ${name} collects, uses and protects your personal information.`,
        body: (
          <>
            <p>
              This policy explains what personal information {legal} (“we”) collects when you visit this website or
              place an order, how we use it and the choices you have. Questions: {mail}.
            </p>
            <h2>What we collect</h2>
            <ul>
              <li><strong>Orders:</strong> your name, email, phone number, shipping and billing address, the products you bought and the order history.</li>
              <li><strong>Payments:</strong> handled by Stripe. Your card details are entered on Stripe’s secure page and never reach or stay on our servers.</li>
              <li><strong>Email sign-up:</strong> your email address, if you join our list or claim the first-order discount.</li>
              <li><strong>Your approximate location:</strong> the country your connection comes from, worked out from your IP address, so prices can be shown in your currency. We don’t store it.</li>
              <li><strong>Visit statistics:</strong> the pages you open, the website that sent you, your country and your type of device (phone, tablet or computer), linked to a random number stored in your browser, never to your name, email or IP address. We use them only to count visits and improve the shop, and delete them after 13 months.</li>
              <li><strong>Your cart:</strong> the products in it. If you gave us your email (at checkout, in the welcome offer or with a discount code) and leave without ordering, we may email you a reminder; reply “unsubscribe” to stop.</li>
              <li><strong>Advertising measurement:</strong> pages viewed and products added to the cart, shared with Google and Meta only if you accept cookies (see below).</li>
            </ul>
            <h2>How we use it</h2>
            <ul>
              <li>to process, ship and track your order, and to send order confirmations and shipping updates;</li>
              <li>to answer your messages, returns and refunds;</li>
              <li>to send news and offers, only if you signed up (every email has an unsubscribe link);</li>
              <li>to keep the shop secure and understand how it’s used.</li>
            </ul>
            <p>We never sell your personal information.</p>
            <h2>Who we share it with</h2>
            <p>Only the service providers that run the shop for us, and only what each one needs:</p>
            <ul>
              <li>Stripe (payments), Supabase (store database and hosting of order data), our email provider (order and shipping emails);</li>
              <li>shipping carriers (your name, address and phone, to deliver the parcel);</li>
              <li>Google and Meta (measurement and advertising), only if you accept cookies.</li>
            </ul>
            <p>
              Some of these providers store data outside your country, including in the United States. They are bound
              by contracts to protect it.
            </p>
            <h2>Cookies and similar storage</h2>
            <ul>
              <li><strong>Always on (needed for the shop to work):</strong> your cart, your currency choice, whether you’ve seen the welcome offer, and a random visitor number for our own visit statistics (kept in your browser for up to 13 months, never shared).</li>
              <li><strong>Only with your consent:</strong> Google Analytics, Google Ads and the Meta Pixel. You can decline in the cookie banner; the shop works the same either way.</li>
            </ul>
            <h2>How long we keep it</h2>
            <p>
              Order records are kept for as long as tax and accounting law requires (generally 6 years in Canada).
              Email-list data is kept until you unsubscribe.
            </p>
            <h2>Your rights</h2>
            <p>
              You can ask to see the personal information we hold about you, correct it, receive a copy, or have it
              deleted (except what we must keep by law), and withdraw your consent to marketing at any time. Email{' '}
              {mail}; we reply within 30 days. If you’re not satisfied, you can contact your data protection authority
              (in Quebec, the Commission d’accès à l’information).
            </p>
            <h2>Person in charge</h2>
            <p>
              The person responsible for protecting personal information at {legal} can be reached at {mail}.
            </p>
            <h2>Changes</h2>
            <p>We may update this policy; the date at the top shows the latest version.</p>
          </>
        )
      };

    case 'terms':
      return {
        title: 'Terms of service',
        updated: POLICY_DATE,
        description: `Terms and conditions for shopping at ${name}.`,
        body: (
          <>
            <p>
              These terms apply to every visit and purchase on this website, operated by {legal}. By placing an order
              you agree to them, together with our <Link href="/pages/shipping">Shipping</Link>,{' '}
              <Link href="/pages/returns">Returns &amp; refunds</Link> and <Link href="/pages/privacy">Privacy</Link>{' '}
              policies.
            </p>
            <h2>Products</h2>
            <p>
              We describe each fragrance, its notes, concentration and size as accurately as we can. Photos are for
              illustration: packaging can change and colours can look different on screen. Fragrance notes are a guide;
              a scent can smell different on each person.
            </p>
            <h2>Prices and currency</h2>
            <p>
              Our prices are set in {cur}. For convenience, the shop can show approximate prices in your own currency
              based on recent exchange rates; these are estimates only. Unless checkout shows otherwise, you are charged
              in {cur}, and your bank may apply its own conversion rate or fees. Taxes and shipping are added at checkout.
              We may change prices at any time; the price that applies is the one shown when you place your order.
            </p>
            <h2>Orders and payment</h2>
            <p>
              Your order is confirmed when payment is accepted and you receive our confirmation email. Payments are
              processed securely by Stripe. We may refuse or cancel an order (for example if an item is out of stock, a
              price was displayed in error or a payment looks fraudulent); if we do, we refund you in full.
            </p>
            <h2>Discount codes</h2>
            <ul>
              <li>One code per order, applied before taxes and shipping.</li>
              <li>First-order codes (such as the welcome offer) work once per customer and email address, on a first order only.</li>
              <li>Codes have no cash value, can’t be exchanged or combined, and may end at any time.</li>
            </ul>
            <h2>Shipping, duties and risk</h2>
            <p>
              Delivery times are estimates; see our <Link href="/pages/shipping">Shipping policy</Link>. International
              orders may be charged import duties and taxes by the destination country, which are the recipient’s
              responsibility. Ownership and risk pass to you when the order is delivered.
            </p>
            <h2>Returns</h2>
            <p>
              Returns and refunds follow our <Link href="/pages/returns">Returns &amp; refunds policy</Link>. Nothing in
              these terms limits the rights you have under the consumer protection laws of where you live.
            </p>
            <h2>Use of the website</h2>
            <p>
              Content on this site (text, photos, design) belongs to {legal} or its licensors; please don’t copy it for
              commercial use. Brand names and logos belong to their respective owners.
            </p>
            <h2>Liability</h2>
            <p>
              To the extent the law allows, our liability for any order is limited to the amount you paid for it. We are
              not responsible for delays or failures caused by events outside our reasonable control.
            </p>
            <h2>Governing law</h2>
            <p>
              These terms are governed by the laws of the Province of Quebec and the federal laws of Canada that apply
              there, without removing any protection you have under the laws of your own country.
            </p>
            <h2>Contact</h2>
            <p>
              {legal} · {mail}
            </p>
          </>
        )
      };

    default:
      return undefined;
  }
}
