-- =============================================================================
-- Commerce backend schema — Supabase (products, orders, customers, discounts)
--
-- Run this once in Supabase: Dashboard → SQL Editor → paste → Run.
-- (Or with the CLI: `supabase db push`.)
--
-- Security model
--   • Storefront (anon)  → can READ active products, variants, images,
--                          published collections and public store settings.
--   • Staff (logged in and listed in `staff`) → full read/write via RLS.
--   • Carts, orders, customers are NEVER exposed to anon. The Next.js server
--     reaches them with the service-role key (server-only env var).
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Staff (admin users)
-- -----------------------------------------------------------------------------

create table public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  name       text,
  role       text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER so RLS policies can call it without recursing into staff's
-- own policies.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'owner');
$$;

-- -----------------------------------------------------------------------------
-- Store settings (single row, id = 1)
-- -----------------------------------------------------------------------------

create table public.store_settings (
  id                       int primary key default 1 check (id = 1),
  store_name               text not null default 'My store',
  contact_email            text,
  phone                    text,
  currency                 text not null default 'CAD',
  address                  jsonb not null default '{}'::jsonb,
  shipping_flat_rate       numeric(10,2) not null default 15.00,
  free_shipping_threshold  numeric(10,2),
  -- Let Stripe Tax compute GST/HST/QST and US sales tax (enable Stripe Tax first).
  stripe_automatic_tax     boolean not null default false,
  allowed_countries        text[] not null default array['CA','US'],
  updated_at               timestamptz not null default now()
);
insert into public.store_settings (id) values (1) on conflict do nothing;
create trigger store_settings_updated before update on public.store_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Catalog
-- -----------------------------------------------------------------------------

create table public.products (
  id               uuid primary key default gen_random_uuid(),
  handle           text not null unique,
  title            text not null,
  description_html text not null default '',
  status           text not null default 'draft' check (status in ('active', 'draft', 'archived')),
  product_type     text,
  vendor           text,
  tags             text[] not null default '{}',
  -- [{ "name": "Size", "values": ["Petite","Classic"] }]  (max 3, like Shopify)
  options          jsonb not null default '[]'::jsonb,
  seo_title        text,
  seo_description  text,
  total_sold       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index products_status_idx on public.products (status);
create index products_tags_idx on public.products using gin (tags);
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url        text not null,
  alt        text,
  width      int,
  height     int,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, position);

create table public.product_variants (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products (id) on delete cascade,
  title              text not null default 'Default Title',
  sku                text,
  price              numeric(10,2) not null default 0,
  compare_at_price   numeric(10,2),
  option1            text,
  option2            text,
  option3            text,
  inventory_quantity int not null default 0,
  track_inventory    boolean not null default false,
  -- "Continue selling when out of stock"
  continue_selling   boolean not null default false,
  position           int not null default 0,
  image_id           uuid references public.product_images (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id, position);
create trigger product_variants_updated before update on public.product_variants
  for each row execute function public.set_updated_at();

create table public.collections (
  id              uuid primary key default gen_random_uuid(),
  handle          text not null unique,
  title           text not null,
  description     text not null default '',
  image_url       text,
  published       boolean not null default true,
  sort_order      int not null default 0,
  seo_title       text,
  seo_description text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger collections_updated before update on public.collections
  for each row execute function public.set_updated_at();

create table public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete cascade,
  position      int not null default 0,
  primary key (collection_id, product_id)
);
create index collection_products_product_idx on public.collection_products (product_id);

-- -----------------------------------------------------------------------------
-- Customers
-- -----------------------------------------------------------------------------

create table public.customers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  first_name        text,
  last_name         text,
  phone             text,
  accepts_marketing boolean not null default false,
  note              text,
  tags              text[] not null default '{}',
  default_address   jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Discounts
-- -----------------------------------------------------------------------------

create table public.discounts (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  type          text not null check (type in ('percentage', 'fixed_amount', 'free_shipping')),
  value         numeric(10,2) not null default 0,
  min_subtotal  numeric(10,2),
  usage_limit   int,
  usage_count   int not null default 0,
  once_per_customer boolean not null default false,
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- Codes are case-insensitive at checkout; store them upper-case.
create unique index discounts_code_upper_idx on public.discounts (upper(code));
create trigger discounts_updated before update on public.discounts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Carts (server-managed; id lives in the `cartId` cookie)
-- -----------------------------------------------------------------------------

create table public.carts (
  id            uuid primary key default gen_random_uuid(),
  status        text not null default 'open' check (status in ('open', 'completed')),
  discount_code text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger carts_updated before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_lines (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity   int not null check (quantity > 0),
  attributes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index cart_lines_cart_idx on public.cart_lines (cart_id);

-- Frozen copy of a cart at the moment the customer is sent to Stripe, so the
-- order always matches what was paid for even if the cart changes afterwards.
create table public.checkouts (
  id                uuid primary key default gen_random_uuid(),
  cart_id           uuid references public.carts (id) on delete set null,
  stripe_session_id text unique,
  snapshot          jsonb not null,
  created_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Orders
-- -----------------------------------------------------------------------------

create sequence public.order_number_seq start 1001;

create table public.orders (
  id                         uuid primary key default gen_random_uuid(),
  order_number               int not null unique default nextval('public.order_number_seq'),
  customer_id                uuid references public.customers (id) on delete set null,
  cart_id                    uuid references public.carts (id) on delete set null,
  email                      text,
  phone                      text,
  financial_status           text not null default 'pending'
    check (financial_status in ('pending', 'paid', 'partially_refunded', 'refunded', 'voided')),
  fulfillment_status         text not null default 'unfulfilled'
    check (fulfillment_status in ('unfulfilled', 'partial', 'fulfilled')),
  status                     text not null default 'open'
    check (status in ('open', 'archived', 'cancelled')),
  currency                   text not null default 'CAD',
  subtotal                   numeric(10,2) not null default 0,
  discount_total             numeric(10,2) not null default 0,
  shipping_total             numeric(10,2) not null default 0,
  tax_total                  numeric(10,2) not null default 0,
  total                      numeric(10,2) not null default 0,
  refunded_total             numeric(10,2) not null default 0,
  discount_code              text,
  shipping_address           jsonb,
  billing_address            jsonb,
  note                       text,
  tags                       text[] not null default '{}',
  tracking_number            text,
  tracking_url               text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text,
  cancelled_at               timestamptz,
  fulfilled_at               timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index orders_created_idx on public.orders (created_at desc);
create index orders_customer_idx on public.orders (customer_id);
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_line_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  variant_id    uuid references public.product_variants (id) on delete set null,
  title         text not null,
  variant_title text,
  sku           text,
  image_url     text,
  quantity      int not null,
  price         numeric(10,2) not null,
  attributes    jsonb not null default '[]'::jsonb,
  fulfilled_quantity int not null default 0
);
create index order_line_items_order_idx on public.order_line_items (order_id);

-- Timeline (Shopify-style: system events + staff comments)
create table public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  kind       text not null default 'system' check (kind in ('system', 'comment')),
  message    text not null,
  author     text,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at desc);

-- Customer stats view for the admin (orders count / total spent)
create or replace view public.customer_stats
with (security_invoker = true) as
select
  c.id,
  count(o.id) filter (where o.financial_status in ('paid','partially_refunded')) as orders_count,
  coalesce(sum(o.total - o.refunded_total) filter (where o.financial_status in ('paid','partially_refunded')), 0) as total_spent,
  max(o.created_at) as last_order_at
from public.customers c
left join public.orders o on o.customer_id = c.id
group by c.id;

-- -----------------------------------------------------------------------------
-- Stock helper, called by the Stripe webhook after payment
-- -----------------------------------------------------------------------------

create or replace function public.apply_order_inventory(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.product_variants v
     set inventory_quantity = v.inventory_quantity - li.quantity
    from public.order_line_items li
   where li.order_id = p_order_id
     and li.variant_id = v.id
     and v.track_inventory;

  update public.products p
     set total_sold = p.total_sold + s.qty
    from (select product_id, sum(quantity) qty
            from public.order_line_items
           where order_id = p_order_id and product_id is not null
           group by product_id) s
   where s.product_id = p.id;

  update public.discounts d
     set usage_count = d.usage_count + 1
    from public.orders o
   where o.id = p_order_id
     and o.discount_code is not null
     and upper(d.code) = upper(o.discount_code);
end $$;
revoke execute on function public.apply_order_inventory(uuid) from public, anon, authenticated;

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.staff               enable row level security;
alter table public.store_settings      enable row level security;
alter table public.products            enable row level security;
alter table public.product_images      enable row level security;
alter table public.product_variants    enable row level security;
alter table public.collections         enable row level security;
alter table public.collection_products enable row level security;
alter table public.customers           enable row level security;
alter table public.discounts           enable row level security;
alter table public.carts               enable row level security;
alter table public.cart_lines          enable row level security;
alter table public.checkouts           enable row level security;
alter table public.orders              enable row level security;
alter table public.order_line_items    enable row level security;
alter table public.order_events        enable row level security;

-- Staff: full access everywhere
create policy staff_all on public.store_settings      for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.products            for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.product_images      for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.product_variants    for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.collections         for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.collection_products for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.customers           for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.discounts           for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.carts               for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.cart_lines          for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.checkouts           for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.orders           for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.order_line_items    for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.order_events        for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Staff table: staff can see the team; only owners can change it.
create policy staff_read  on public.staff for select to authenticated using (public.is_staff());
create policy owner_write on public.staff for all    to authenticated using (public.is_owner()) with check (public.is_owner());

-- Public storefront reads
create policy public_read on public.store_settings for select to anon, authenticated using (true);
create policy public_read on public.products       for select to anon, authenticated using (status = 'active');
create policy public_read on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy public_read on public.product_variants for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy public_read on public.collections for select to anon, authenticated using (published);
create policy public_read on public.collection_products for select to anon, authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.published));

-- =============================================================================
-- Storage buckets
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true),
       ('customer-uploads', 'customer-uploads', true)
on conflict (id) do nothing;

-- Staff upload/manage product media. Public read comes from the bucket being public.
create policy "staff manage product images" on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images' and public.is_staff())
  with check (bucket_id = 'product-images' and public.is_staff());

-- Customer photo uploads go through /api/upload with the service role key,
-- so no anon insert policy is needed.

-- =============================================================================
-- FIRST OWNER — after creating your login in Authentication → Users, run:
--
--   insert into public.staff (user_id, email, name, role)
--   select id, email, 'Owner', 'owner' from auth.users where email = 'you@example.com';
-- =============================================================================
