-- =============================================================================
-- MyScentStory — perfume attributes + merchant-feed fields
--
-- Run once in Supabase (SQL Editor → paste → Run) AFTER 0001_commerce.sql.
-- Safe to re-run: every statement is "if not exists".
-- =============================================================================

-- Fragrance attributes shown on the product page and sent to Google / Meta.
alter table public.products
  add column if not exists gender        text check (gender in ('female', 'male', 'unisex')),
  add column if not exists concentration text,              -- "Eau de Parfum", "Eau de Toilette"…
  add column if not exists scent_family  text,              -- "Woody", "Floral", "Amber"…
  add column if not exists top_notes     text[] not null default '{}',
  add column if not exists heart_notes   text[] not null default '{}',
  add column if not exists base_notes    text[] not null default '{}';

create index if not exists products_gender_idx on public.products (gender);

-- Barcode (UPC / EAN / GTIN). Google Shopping and Meta match branded perfumes
-- by GTIN, so fill this in for every bottle that has one on the box.
alter table public.product_variants
  add column if not exists barcode text;

-- Brand the store (only if the name was never changed in /admin → Settings).
update public.store_settings set store_name = 'MyScentStory' where store_name = 'My store';
