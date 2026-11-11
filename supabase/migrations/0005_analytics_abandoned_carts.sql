-- =============================================================================
-- 0005: store analytics (visitors, page views, live view) and abandoned carts.
-- Safe to run more than once.
--
-- Privacy: no IP addresses and no browser fingerprints are stored. A visitor is
-- a random id kept in the shopper's browser; we keep the country (from the
-- hosting provider's lookup), a device class and the referring site's name.
-- =============================================================================

-- One row per page a shopper opens.
create table if not exists public.page_views (
  id         bigint generated always as identity primary key,
  visitor_id uuid not null,
  session_id uuid not null,
  path       text not null,
  created_at timestamptz not null default now()
);
create index if not exists page_views_created_idx on public.page_views (created_at);

-- One row per visit (a session ends after 30 minutes without activity).
create table if not exists public.visitor_sessions (
  id           uuid primary key,
  visitor_id   uuid not null,
  landing_path text not null,
  current_path text not null,
  referrer     text,
  country      text,
  device       text check (device in ('mobile', 'tablet', 'desktop')),
  page_views   int not null default 0,
  cart_id      uuid references public.carts (id) on delete set null,
  started_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);
create index if not exists visitor_sessions_started_idx on public.visitor_sessions (started_at);
create index if not exists visitor_sessions_last_seen_idx on public.visitor_sessions (last_seen);

alter table public.page_views enable row level security;
alter table public.visitor_sessions enable row level security;
drop policy if exists staff_read on public.page_views;
create policy staff_read on public.page_views for select to authenticated using (public.is_staff());
drop policy if exists staff_read on public.visitor_sessions;
create policy staff_read on public.visitor_sessions for select to authenticated using (public.is_staff());
-- Shoppers never touch these tables: /api/track writes through analytics_record().

-- Records a page view (p_view = true) or a "still here" ping (p_view = false).
create or replace function public.analytics_record(
  p_session uuid, p_visitor uuid, p_path text, p_referrer text, p_country text, p_device text,
  p_cart uuid, p_view boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_view then
    insert into page_views (visitor_id, session_id, path) values (p_visitor, p_session, p_path);
  end if;
  insert into visitor_sessions as s (id, visitor_id, landing_path, current_path, referrer, country, device, page_views, cart_id)
  values (p_session, p_visitor, p_path, p_path, p_referrer, p_country, p_device, case when p_view then 1 else 0 end,
          (select id from carts where id = p_cart))
  on conflict (id) do update set
    current_path = excluded.current_path,
    last_seen    = now(),
    page_views   = s.page_views + case when p_view then 1 else 0 end,
    cart_id      = coalesce(excluded.cart_id, s.cart_id);
end $$;
revoke all on function public.analytics_record(uuid, uuid, text, text, text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.analytics_record(uuid, uuid, text, text, text, text, uuid, boolean) to service_role;

-- Everything the Analytics page shows for the last p_days days (1 = today), in
-- the store's time zone, in one call.
create or replace function public.analytics_summary(p_days int, p_tz text default 'America/Toronto')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
  p_to   timestamptz := now();
  p_from timestamptz := (date_trunc('day', now() at time zone p_tz) - make_interval(days => greatest(p_days, 1) - 1)) at time zone p_tz;
begin
  if not public.is_staff() then raise exception 'Staff only' using errcode = '42501'; end if;

  with s as (select * from visitor_sessions where started_at >= p_from and started_at < p_to),
       v as (select * from page_views where created_at >= p_from and created_at < p_to),
       o as (select * from orders where created_at >= p_from and created_at < p_to
               and financial_status in ('paid', 'partially_refunded', 'refunded'))
  select jsonb_build_object(
    'sessions',      (select count(*) from s),
    'visitors',      (select count(distinct visitor_id) from s),
    'page_views',    (select count(*) from v),
    'bounced',       (select count(*) from s where page_views <= 1),
    -- A cart is only created when something is added to it.
    'added_to_cart', (select count(*) from s where cart_id is not null),
    'reached_checkout', (select count(*) from s where exists (select 1 from checkouts c where c.cart_id = s.cart_id)),
    'orders',        (select count(*) from o),
    'sales',         (select coalesce(sum(total - refunded_total), 0) from o),
    'daily', (
      select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb) from (
        select to_char(day, 'YYYY-MM-DD') as day,
               (select count(*) from s where (s.started_at at time zone p_tz)::date = day) as sessions,
               (select count(distinct visitor_id) from s where (s.started_at at time zone p_tz)::date = day) as visitors,
               (select count(*) from v where (v.created_at at time zone p_tz)::date = day) as page_views
        from generate_series((p_from at time zone p_tz)::date, (p_to at time zone p_tz)::date, interval '1 day') as day
      ) d
    ),
    'top_pages', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select path, count(*) as views, count(distinct visitor_id) as visitors
        from v group by path order by views desc limit 10
      ) t
    ),
    'referrers', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(referrer, 'Direct') as name, count(*) as sessions
        from s group by 1 order by sessions desc limit 10
      ) t
    ),
    'countries', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(country, '??') as code, count(*) as sessions
        from s group by 1 order by sessions desc limit 10
      ) t
    ),
    'devices', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(device, 'desktop') as name, count(*) as sessions
        from s group by 1 order by sessions desc
      ) t
    )
  ) into result;
  return result;
end $$;
revoke all on function public.analytics_summary(int, text) from public, anon;
grant execute on function public.analytics_summary(int, text) to authenticated;

-- Who is on the store right now (active in the last 5 minutes).
create or replace function public.analytics_live()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_staff() then raise exception 'Staff only' using errcode = '42501'; end if;
  with live as (select * from visitor_sessions where last_seen > now() - interval '5 minutes')
  select jsonb_build_object(
    'visitors', (select count(distinct visitor_id) from live),
    'in_cart',  (select count(*) from live where cart_id is not null
                   and exists (select 1 from cart_lines l where l.cart_id = live.cart_id)),
    'pages', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select current_path as path, count(*) as visitors from live group by 1 order by 2 desc limit 8
      ) t
    ),
    'countries', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(country, '??') as code, count(*) as visitors from live group by 1 order by 2 desc limit 8
      ) t
    ),
    'sessions', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select current_path as path, country, device, referrer, page_views, last_seen, started_at,
               exists (select 1 from cart_lines l where l.cart_id = live.cart_id) as has_cart
        from live order by last_seen desc limit 25
      ) t
    )
  ) into result;
  return result;
end $$;
revoke all on function public.analytics_live() from public, anon;
grant execute on function public.analytics_live() to authenticated;

-- Deletes analytics older than about 13 months (called now and then by /api/track).
create or replace function public.analytics_purge(p_keep_days int default 400)
returns void language sql security definer set search_path = public as $$
  delete from page_views where created_at < now() - make_interval(days => p_keep_days);
  delete from visitor_sessions where last_seen < now() - make_interval(days => p_keep_days);
$$;
revoke all on function public.analytics_purge(int) from public, anon, authenticated;
grant execute on function public.analytics_purge(int) to service_role;

-- -----------------------------------------------------------------------------
-- Abandoned carts
-- -----------------------------------------------------------------------------

-- When a reminder email was sent, and the email Stripe collected if the shopper
-- reached checkout but never paid.
alter table public.carts add column if not exists recovery_email_sent_at timestamptz;
-- Last time the shopper changed the cart's items (updated_at also moves when
-- staff send a reminder, so it can't be used to tell how long a cart sat idle).
alter table public.carts add column if not exists activity_at timestamptz;
update public.carts set activity_at = updated_at where activity_at is null;
alter table public.carts alter column activity_at set default now();
alter table public.carts alter column activity_at set not null;
alter table public.checkouts add column if not exists expired_at timestamptz;
alter table public.checkouts add column if not exists email text;

-- Adding, changing or removing an item counts as cart activity.
create or replace function public.touch_cart() returns trigger language plpgsql as $$
begin
  update public.carts set activity_at = now() where id = coalesce(new.cart_id, old.cart_id);
  return null;
end $$;
drop trigger if exists cart_lines_touch on public.cart_lines;
create trigger cart_lines_touch after insert or update or delete on public.cart_lines
  for each row execute function public.touch_cart();

create index if not exists carts_open_activity_idx on public.carts (activity_at) where status = 'open';
create index if not exists checkouts_cart_idx on public.checkouts (cart_id);
