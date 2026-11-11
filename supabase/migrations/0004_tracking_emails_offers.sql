-- =============================================================================
-- MyScentStory — shipment tracking, order emails, first-order offer, shipping
--
-- Run once in Supabase (SQL Editor → paste → Run) AFTER 0003. Safe to re-run.
-- =============================================================================

-- --- Shipping & contact defaults ---------------------------------------------
-- Only changes values still at the starter defaults, so edits made in
-- /admin → Settings are never overwritten.
update public.store_settings set shipping_flat_rate = 25 where id = 1 and shipping_flat_rate = 15;
update public.store_settings set free_shipping_threshold = 600 where id = 1 and free_shipping_threshold is null;
update public.store_settings set allowed_countries = array['WORLD'] where id = 1 and allowed_countries = array['CA','US'];
update public.store_settings set contact_email = 'support@myscentstory.net' where id = 1 and contact_email is null;
alter table public.store_settings alter column shipping_flat_rate set default 25;
alter table public.store_settings alter column allowed_countries set default array['WORLD'];

-- --- First-order discounts ---------------------------------------------------
alter table public.discounts
  add column if not exists first_order_only boolean not null default false;

insert into public.discounts (code, type, value, first_order_only)
values ('WELCOME10', 'percentage', 10, true)
on conflict (code) do nothing;
update public.discounts set first_order_only = true where upper(code) = 'WELCOME10';

-- Email the shopper gave for a first-order code; passed to Stripe Checkout so
-- the order is placed with that same address.
alter table public.carts add column if not exists email text;

-- --- Shipment tracking --------------------------------------------------------
alter table public.orders
  add column if not exists shipment_status text not null default 'confirmed'
    check (shipment_status in ('confirmed', 'processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'exception')),
  add column if not exists carrier text,
  add column if not exists estimated_delivery date,
  add column if not exists confirmation_email_sent_at timestamptz;

update public.orders set shipment_status = 'shipped'
 where fulfillment_status = 'fulfilled' and shipment_status = 'confirmed';

create index if not exists orders_email_idx on public.orders (lower(email));

-- Customer-visible shipment updates (the admin timeline stays in order_events).
create table if not exists public.order_tracking_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  status     text not null
    check (status in ('confirmed', 'processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'exception')),
  message    text,
  location   text,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists order_tracking_events_order_idx on public.order_tracking_events (order_id, created_at desc);

alter table public.order_tracking_events enable row level security;
drop policy if exists staff_all on public.order_tracking_events;
create policy staff_all on public.order_tracking_events for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
-- Shoppers never read this table directly: the /track page looks orders up on
-- the server after checking the order number and email.
