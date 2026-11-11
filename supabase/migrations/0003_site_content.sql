-- =============================================================================
-- MyScentStory — editable storefront content (/admin → Online store)
--
-- Run once in Supabase (SQL Editor → paste → Run) AFTER 0002.
-- Safe to re-run.
--
-- One row holding the home page banner, announcement bar, promo band, section
-- headings, social links and home page SEO as JSON. Anything left out falls
-- back to the defaults in src/lib/content.ts, so the storefront keeps working
-- before this migration has been run.
-- =============================================================================

create table if not exists public.site_content (
  id         int primary key default 1 check (id = 1),
  content    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.site_content (id) values (1) on conflict do nothing;

drop trigger if exists site_content_updated on public.site_content;
create trigger site_content_updated before update on public.site_content
  for each row execute function public.set_updated_at();

alter table public.site_content enable row level security;

drop policy if exists staff_all on public.site_content;
create policy staff_all on public.site_content for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists public_read on public.site_content;
create policy public_read on public.site_content for select to anon, authenticated using (true);
