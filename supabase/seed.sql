-- ---------------------------------------------------------------------------
-- Optional starter data for MyScentStory. Run AFTER 0001_commerce.sql and
-- 0002_perfume_merchant.sql.
--
-- Creates the four collections the storefront menu expects and two sample
-- perfumes (invented, saved as DRAFT so they never show on the live store or
-- in the Google / Meta feed). Open them in /admin → Products to see how a
-- listing is filled in, then delete them.
--
-- Skips itself if the store already has products, so re-running is harmless.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from public.products) then
    raise notice 'Products already exist — skipping starter data.';
    return;
  end if;

insert into public.collections (id, handle, title, description, sort_order, seo_title, seo_description)
values
  ('1c000000-0000-4000-8000-000000000001', 'for-her', 'For her',
   'Perfumes for women: florals, ambers and gourmands in eau de parfum and eau de toilette.', 0,
   'Perfumes for Women', 'Shop women''s perfumes at MyScentStory: floral, amber and gourmand eau de parfum and eau de toilette.'),
  ('1c000000-0000-4000-8000-000000000002', 'for-him', 'For him',
   'Colognes and perfumes for men: woods, leathers and fresh aromatics.', 1,
   'Colognes & Perfumes for Men', 'Shop men''s colognes and perfumes at MyScentStory: woody, leather and fresh fragrances.'),
  ('1c000000-0000-4000-8000-000000000003', 'unisex', 'Unisex',
   'Fragrances made to be shared, from bright citrus to smoky oud.', 2,
   'Unisex Perfumes', 'Shop unisex perfumes at MyScentStory, from bright citrus to smoky oud.'),
  ('1c000000-0000-4000-8000-000000000004', 'gift-sets', 'Gift sets',
   'Ready-to-give perfume gift sets and discovery boxes.', 3,
   'Perfume Gift Sets', 'Shop perfume gift sets and discovery boxes at MyScentStory.')
on conflict (handle) do nothing;

insert into public.products
  (id, handle, title, description_html, status, product_type, vendor, tags, options,
   gender, concentration, scent_family, top_notes, heart_notes, base_notes)
values
  ('1a000000-0000-4000-8000-000000000001', 'sample-velours-noir-eau-de-parfum', 'Velours Noir Eau de Parfum',
   '<p>A deep, velvety amber built around black plum, night-blooming jasmine and warm vanilla.</p>',
   'draft', 'Perfume', 'Sample House', '{sample}',
   '[{"name":"Size","values":["50 ml","90 ml"]}]'::jsonb,
   'female', 'Eau de Parfum', 'Amber', '{Black plum,Pink pepper}', '{Jasmine,Orange blossom}', '{Vanilla,Patchouli}'),
  ('1a000000-0000-4000-8000-000000000002', 'sample-cedre-bleu-eau-de-parfum', 'Cèdre Bleu Eau de Parfum',
   '<p>Crisp bergamot over sage and geranium, drying down to blue cedar and amberwood.</p>',
   'draft', 'Perfume', 'Sample House', '{sample}', '[]'::jsonb,
   'male', 'Eau de Parfum', 'Woody', '{Bergamot,Ginger}', '{Sage,Geranium}', '{Cedarwood,Amberwood}')
on conflict (handle) do nothing;

insert into public.product_variants
  (product_id, title, price, compare_at_price, option1, sku, inventory_quantity, track_inventory, position)
values
  ('1a000000-0000-4000-8000-000000000001', '50 ml', 112.00, 140.00, '50 ml', 'SAMPLE-VN-50', 10, true, 0),
  ('1a000000-0000-4000-8000-000000000001', '90 ml', 158.00, null,   '90 ml', 'SAMPLE-VN-90', 4,  true, 1),
  ('1a000000-0000-4000-8000-000000000002', 'Default Title', 128.00, null, null, 'SAMPLE-CB-100', 6, true, 0)
on conflict do nothing;

insert into public.collection_products (collection_id, product_id, position)
values
  ('1c000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 0),
  ('1c000000-0000-4000-8000-000000000002', '1a000000-0000-4000-8000-000000000002', 0)
on conflict do nothing;

insert into public.discounts (code, type, value) values ('WELCOME10', 'percentage', 10)
on conflict (code) do nothing;
end $$;
