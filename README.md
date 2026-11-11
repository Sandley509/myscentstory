# MyScentStory

Online perfume store: a **Next.js storefront** on a **Supabase + Stripe** backend with a Shopify-style
**admin at `/admin`**. Built to be found on Google and to plug into Google Merchant Center and
Facebook / Instagram Shops.

```
src/
  app/
    (store)/            Storefront: home, /collections/[handle], /products/[handle], /search, /pages/[slug]
    feeds/              /feeds/google.xml and /feeds/meta.xml (product feed)
    admin/              Admin: orders, products, customers, discounts, settings
    api/                Stripe webhook, image upload, revalidate
    sitemap.ts, robots.ts, manifest.ts
  components/store/     Header, footer, product card, product page, cart drawer, tracking
  lib/
    site.ts             Brand copy, socials, return window, delivery estimates  ← edit this
    pages.tsx           Shipping / returns / privacy / terms / contact / about text  ← review this
    seo.ts              Structured data (JSON-LD) for Google
    feed.ts             Google / Meta product feed
    track.ts            GA4, Google Ads and Meta Pixel events
    commerce/           Data layer (products, cart, checkout, orders)
scripts/create-admin.mjs  npm run create-admin: creates your admin login
supabase/
  migrations/0001_commerce.sql          Core schema
  migrations/0002_perfume_merchant.sql  Fragrance fields + barcode
  migrations/0003_site_content.sql      Editable storefront content (/admin → Online store)
  seed.sql                              Collections + two draft sample perfumes
```

## Run it

1. `npm install`
2. `cp .env.example .env.local`
3. `npm run dev` → storefront on `http://localhost:3000`, admin on `/admin`.

Without Supabase keys the store runs on an invented demo catalogue (`src/lib/commerce/mock.ts`) so
you can see every page straight away. The demo disappears as soon as Supabase is connected.

### Supabase (about 10 minutes)

1. Create a project at supabase.com.
2. **SQL Editor → New query** → run `supabase/migrations/0001_commerce.sql`, then
   `0002_perfume_merchant.sql`, then `0003_site_content.sql`, then `0004_tracking_emails_offers.sql`, then (optional)
   `supabase/seed.sql`. Already live? Just run `0004` — it is safe to run twice.
3. **Project Settings → API** → copy the project URL, the anon/publishable key and the
   service_role/secret key into `.env.local`.
4. Create your admin login: `npm run create-admin` (see below).
5. **Authentication → Providers → Email** → turn off public sign-ups, so only you can create accounts.

### Stripe (about 10 minutes)

1. Copy your secret key into `STRIPE_SECRET_KEY`.
2. **Developers → Webhooks → Add endpoint**
   - URL `https://YOUR-DOMAIN/api/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`
   - Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
4. Turn on **Settings → Customer emails → Successful payments** so customers get receipts.
5. Taxes: enable **Stripe Tax**, add your registrations, then tick “Calculate taxes automatically”
   in /admin → Settings.

## Your admin account

Create it once, from the project folder, after Supabase is set up and `.env.local` is filled in:

```bash
npm run create-admin
```

It asks for your email, your name and a password (typed hidden, at least 8 characters), creates the
account already confirmed and makes it the store **owner**. Then sign in at
`https://YOUR-DOMAIN/admin/login` (locally: `http://localhost:3000/admin/login`).

- Forgot the password? Run `npm run create-admin` again with the same email: it sets the new password.
- Staff accounts: add them in /admin → Settings → Users, or `npm run create-admin -- --role staff`.
- Without the script: Supabase → Authentication → Users → Add user (tick *Auto Confirm*), then in the
  SQL editor:
  ```sql
  insert into public.staff (user_id, email, name, role)
  select id, email, 'Owner', 'owner' from auth.users where email = 'you@example.com';
  ```

## Importing products from Excel

/admin → Products → **Import**. Choose an .xlsx file (one product per row), then select the photos it
names in the *Image files* column (you can select a whole folder's photos at once). Check the preview
and click Import. Photos upload straight to your Supabase storage.

- Required columns: **Title** and **Price**. Everything else is optional; hover a column header in the
  template for what it does. *Download template* on the import page gives a blank sheet with examples.
- Several sizes: extra rows with the same **Handle**, filling only Size, Price, SKU, Barcode, Inventory.
- Importing again is safe: a product whose Handle already exists is updated (price, text, sizes), its
  photos are kept, nothing is duplicated.
- Shopify product exports work too (Vendor, Body (HTML), Variant Price, Option1 Value, Image Src...).

## Adding a perfume (what Google and Meta need)

In /admin → Products → Add product, fill in:

| Field | Why it matters |
|---|---|
| Title | e.g. “Sauvage Eau de Parfum”. Becomes the page title and the ad title. |
| Brand (vendor) | Required by Google and Meta. Shown above the title. |
| Media | A real photo (JPG/PNG/WebP, at least 800×800, plain background). Products without a photo are left out of the feed. |
| Variants → Size | One variant per bottle size, each with its own price. |
| Compare-at price | Shows the crossed-out price and “x% off”; sent to Google as a sale price. |
| Barcode | The UPC/EAN on the box. Branded perfumes are matched by it; missing barcodes limit Shopping visibility. |
| Fragrance details | For her/him/unisex, concentration, scent family and notes. Shown on the page and in structured data. |
| Search engine listing | Optional custom Google title (70 chars) and description (160 chars). |

Tags with a meaning: `new` and `bestseller` add a badge, `hidden` removes the product from listings.
Collections with handles `for-her`, `for-him`, `unisex`, `gift-sets` fill the menu (created by the seed).

## Order emails and tracking

Customers get a **confirmation email** as soon as Stripe confirms payment, and a **shipping email**
each time you post an update. Emails go through [Resend](https://resend.com):

1. Sign up, then **Domains → Add domain** → `myscentstory.net` and add the DNS records it shows.
2. **API Keys → Create** → put it in `RESEND_API_KEY`. Keep `EMAIL_FROM` on the verified domain.
3. /admin → Settings shows "Order emails (Resend)" as ready once it works.

Shipping an order: /admin → Orders → open the order → **Fulfil**. Pick the carrier, paste the tracking
number (the carrier link is filled in for you) and leave "Email the customer" ticked. Later updates
(in transit, out for delivery, delivered, problem) go in the **Shipment tracking** card on the same
page; each can be emailed. "Delivered" also marks the order fulfilled.

Customers track at **/track** with their order number and email (both are needed so nobody can
look up someone else's order). The emails and the order-success page carry a private link that opens
the tracking page directly.

## Currency converter

Shoppers see prices in their own currency, picked from the country their connection comes from
(Vercel, Cloudflare and Netlify provide it automatically). They can change it in the header.
Rates come from open.er-api.com and refresh every 6 hours. **Payment is always taken in CAD**; the
product page and cart say so. Google, Meta and search engines always see CAD prices.
Optional: turn on **Stripe → Settings → Adaptive Pricing** to let Stripe charge in the local currency.
`EXCHANGE_RATES_URL` can point to a different rates provider with the same response format.

## First-order offer (10% off)

First-time visitors see a popup after a few seconds offering **WELCOME10**. Giving an email adds
them to the newsletter list and the code applies to their cart automatically. The code is
"first order only": checkout asks for the shopper's email and refuses it if that email already has
a paid order. Edit the popup text or turn it off in /admin → **Online store → Welcome offer**;
edit the code itself in /admin → **Discounts**.

## Editing the storefront without code

/admin → **Online store** edits the announcement bar, the main banner (photo, heading, text, button),
the promo band, the home page section headings, the category tiles (which collection each opens, its name and photo), the social links and the home page's Google title and
description. Changes go live on save. It needs `supabase/migrations/0003_site_content.sql`.
The default banner photo is `public/banners/hero.jpg`.

## SEO: what is built in

- Server-rendered pages with one `<h1>`, clean Shopify-style URLs (`/products/…`, `/collections/…`).
- Unique title, meta description, canonical URL and Open Graph tags per page.
- JSON-LD: `Product` with price, stock, brand, GTIN, shipping and return policy; `BreadcrumbList`;
  `CollectionPage`; `OnlineStore`; `WebSite` with search box.
- `/sitemap.xml` (with product images) and `/robots.txt`. Search result pages are `noindex`.
- Home and product pages are cached and refreshed every 5 minutes, and at once on save in the admin.
- Shipping, returns, privacy, terms and contact pages, which Merchant Center requires.

## Going live on Google and Meta

Set `NEXT_PUBLIC_SITE_URL` to the real domain first; every URL below is built from it.

**Google Search Console** — add the domain, paste the HTML-tag code into
`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, redeploy, verify, then submit `/sitemap.xml`.

**Google Merchant Center** (free listings + Shopping ads)
1. Create the account, verify and claim the website (same verification tag).
2. Business info: address, customer-service contact. Shipping and returns: enter the same values as
   /admin → Settings and `src/lib/site.ts`.
3. Products → Feeds → Add feed → *Scheduled fetch* → `https://YOUR-DOMAIN/feeds/google.xml`, daily.
4. Link Merchant Center to Google Ads when you are ready to run Shopping / Performance Max campaigns.

**Facebook & Instagram Shop**
1. Meta Business Settings → Brand safety → Domains → add the domain, paste the meta-tag value into
   `NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION`.
2. Commerce Manager → Catalog → Data sources → Data feed → *Scheduled feed* →
   `https://YOUR-DOMAIN/feeds/meta.xml`.
3. Create the shop with “Checkout on your website”. Connect the Instagram business account.

**Tracking for ads** — set `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID` (+ purchase label) and
`NEXT_PUBLIC_META_PIXEL_ID`. The store then sends view item, add to cart, begin checkout and purchase
with the same product ids as the feed, which is what dynamic remarketing needs. Tags load only after
the visitor accepts the cookie banner.

## What the backend gives you

| Area | Details |
|---|---|
| Products | Variants (up to 3 options), images in Supabase Storage, tags, type, brand, SEO, draft/active/archived, barcode (GTIN), fragrance details (for her/him, concentration, scent family, top/heart/base notes) |
| Collections | Manual collections with drag-free ordering, image, visibility |
| Orders | Created automatically from paid Stripe sessions; fulfilment, tracking, timeline with staff comments, notes, cancel, refund (full or partial), archive |
| Customers | Auto-created at checkout, order history, spend, marketing consent, notes, tags |
| Discounts | Percentage, fixed amount, free shipping; minimum spend, usage limit, active dates |
| Settings | Store details, currency, flat/free shipping, Stripe Tax toggle, delivery countries, staff accounts |
| Inventory | Optional per variant; decremented on payment, restocked on refund/cancel |

## The data layer (`@/lib/commerce`)

Your storefront only ever calls these — they return plain, UI-friendly objects:

```ts
getProduct(handle)            getProducts({ query, sortKey, reverse })
getCollection(handle)         getCollectionProducts({ collection, sortKey, reverse })
getCollections()              getProductRecommendations(productId)
getCart()                     addToCart(lines)      updateCart(lines)
removeFromCart(lineIds)       setCartDiscount(code) getStoreSettings()
```

Cart mutations live in `src/components/store/cart-actions.ts`. **They return the updated cart and the
client adopts it** — never rely on a layout re-render after a server action, that is the classic
"item added but the cart looks empty" bug.

Checkout: `startCheckout()` (in `lib/commerce/checkout.ts`) re-validates prices, stock and the discount
server-side, freezes the cart into a `checkouts` row, and creates the Stripe session. The webhook turns
the paid session into an order — idempotently, so Stripe retries can't double-book.

### Custom line data

`addItem({ variantId, quantity, attributes })` accepts arbitrary `{ key, value }` attributes — an
uploaded photo URL, a delivery date, an engraving. They ride along to the order and show up on the
order page in /admin, with no schema change. Image uploads from customers can POST to `/api/upload`,
which stores the file in the `customer-uploads` bucket and returns its public URL.

## Security model

- Storefront reads use the **anon key**; RLS only exposes active products and published collections.
- Carts, orders and customers are never readable by the browser. The server reaches them with the
  **service-role key** (server-only, never `NEXT_PUBLIC_`).
- Admin pages and actions run as the signed-in staff user, and RLS re-checks `is_staff()` on every
  query — so a leaked page URL isn't enough to read or change anything.
- `middleware.ts` protects `/admin` and refreshes the session cookie.
- Product descriptions written in the admin are sanitised before being stored.

## Rebranding checklist

- Brand copy, social links, return window and delivery estimates: `src/lib/site.ts`.
- `NEXT_PUBLIC_STORE_NAME` in `.env.local` and the store name in /admin → Settings.
- Storefront colours and fonts: the `@theme` block at the top of `src/app/globals.css`. The admin
  palette lives in the same file below it — leave that alone so every project's admin looks the same.
- `public/placeholder.svg` — the fallback product image. `public/art/*` — placeholder banner artwork.
- Currency and delivery countries: /admin → Settings.

## Known gaps (add per project if needed)

- No customer accounts or login on the storefront (guest checkout only).
- English only (a French version is needed to sell in Quebec).
- No product reviews.
- No gift cards, no automatic discounts (codes only). Converted prices are estimates; payment is in CAD.
- `/api/upload` is public and has no rate limit — add one before a launch that accepts uploads.
- Tracking updates are posted by hand; there is no automatic carrier-status sync.
- The /track lookup rate limit is per server instance; add a shared store (e.g. Upstash) at scale.
