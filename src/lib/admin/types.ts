import type { ProductStatus } from '@/lib/commerce/db';

export type VariantInput = {
  id?: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  price: string;
  compare_at_price: string;
  sku: string;
  barcode: string;
  inventory_quantity: number;
  track_inventory: boolean;
  continue_selling: boolean;
};

export type ProductInput = {
  id?: string;
  title: string;
  handle: string;
  description_html: string;
  status: ProductStatus;
  product_type: string;
  vendor: string;
  tags: string[];
  seo_title: string;
  seo_description: string;
  gender: '' | 'female' | 'male' | 'unisex';
  concentration: string;
  scent_family: string;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  options: { name: string; values: string[] }[];
  variants: VariantInput[];
  images: { id?: string; url: string; alt: string | null; width: number | null; height: number | null }[];
  collection_ids: string[];
};

export type CollectionInput = {
  id?: string;
  title: string;
  handle: string;
  description: string;
  image_url: string | null;
  published: boolean;
  sort_order: number;
  seo_title: string;
  seo_description: string;
  product_ids: string[];
};

export type DiscountInput = {
  id?: string;
  code: string;
  type: 'percentage' | 'fixed_amount' | 'free_shipping';
  value: string;
  min_subtotal: string;
  usage_limit: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  first_order_only: boolean;
  once_per_customer: boolean;
};

export type CustomerInput = {
  id?: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  accepts_marketing: boolean;
  note: string;
  tags: string[];
};
