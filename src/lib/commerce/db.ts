/**
 * Row types for the Supabase tables (see supabase/migrations/0001_commerce.sql).
 * Hand-written to stay dependency-free; regenerate with
 * `supabase gen types typescript` later if you prefer generated types.
 */

export type ProductStatus = 'active' | 'draft' | 'archived';

export type ProductOptionRow = { name: string; values: string[] };

export type ProductRow = {
  id: string;
  handle: string;
  title: string;
  description_html: string;
  status: ProductStatus;
  product_type: string | null;
  vendor: string | null;
  tags: string[];
  options: ProductOptionRow[];
  seo_title: string | null;
  seo_description: string | null;
  /** Added by 0002_perfume_merchant.sql — undefined until that migration runs. */
  gender?: 'female' | 'male' | 'unisex' | null;
  concentration?: string | null;
  scent_family?: string | null;
  top_notes?: string[] | null;
  heart_notes?: string[] | null;
  base_notes?: string[] | null;
  total_sold: number;
  created_at: string;
  updated_at: string;
};

export type ProductImageRow = {
  id: string;
  product_id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  position: number;
};

export type VariantRow = {
  id: string;
  product_id: string;
  title: string;
  sku: string | null;
  /** UPC / EAN / GTIN (0002_perfume_merchant.sql). */
  barcode?: string | null;
  price: number | string;
  compare_at_price: number | string | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  inventory_quantity: number;
  track_inventory: boolean;
  continue_selling: boolean;
  position: number;
  image_id: string | null;
};

export type ProductWithRelations = ProductRow & {
  product_images: ProductImageRow[];
  product_variants: VariantRow[];
};

export type CollectionRow = {
  id: string;
  handle: string;
  title: string;
  description: string;
  image_url: string | null;
  published: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  accepts_marketing: boolean;
  note: string | null;
  tags: string[];
  default_address: Address | null;
  created_at: string;
};

export type Address = {
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  phone?: string | null;
};

export type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping';

export type DiscountRow = {
  id: string;
  code: string;
  type: DiscountType;
  value: number | string;
  min_subtotal: number | string | null;
  usage_limit: number | null;
  usage_count: number;
  once_per_customer: boolean;
  /** Added by 0004: only customers with no previous paid order (needs the shopper's email). */
  first_order_only?: boolean;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  created_at: string;
};

export type FinancialStatus = 'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'voided';
export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled';
export type OrderStatus = 'open' | 'archived' | 'cancelled';

export type LineAttribute = { key: string; value: string };

export type OrderRow = {
  id: string;
  order_number: number;
  customer_id: string | null;
  email: string | null;
  phone: string | null;
  financial_status: FinancialStatus;
  fulfillment_status: FulfillmentStatus;
  status: OrderStatus;
  currency: string;
  subtotal: number | string;
  discount_total: number | string;
  shipping_total: number | string;
  tax_total: number | string;
  total: number | string;
  refunded_total: number | string;
  discount_code: string | null;
  shipping_address: Address | null;
  billing_address: Address | null;
  note: string | null;
  tags: string[];
  tracking_number: string | null;
  tracking_url: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  cancelled_at: string | null;
  fulfilled_at: string | null;
  created_at: string;
  /** Added by 0004_tracking_emails_offers.sql. */
  shipment_status?: 'confirmed' | 'processing' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception';
  carrier?: string | null;
  estimated_delivery?: string | null;
  confirmation_email_sent_at?: string | null;
};

export type TrackingEventRow = {
  id: string;
  order_id: string;
  status: NonNullable<OrderRow['shipment_status']>;
  message: string | null;
  location: string | null;
  emailed_at: string | null;
  created_at: string;
};

export type OrderLineItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  title: string;
  variant_title: string | null;
  sku: string | null;
  image_url: string | null;
  quantity: number;
  price: number | string;
  attributes: LineAttribute[];
  fulfilled_quantity: number;
};

export type OrderEventRow = {
  id: string;
  order_id: string;
  kind: 'system' | 'comment';
  message: string;
  author: string | null;
  created_at: string;
};

export type StoreSettingsRow = {
  id: 1;
  store_name: string;
  contact_email: string | null;
  phone: string | null;
  currency: string;
  address: Address;
  shipping_flat_rate: number | string;
  free_shipping_threshold: number | string | null;
  stripe_automatic_tax: boolean;
  allowed_countries: string[];
};

/** Snapshot stored in `checkouts.snapshot` and turned into an order by the webhook. */
export type CheckoutSnapshot = {
  currency: string;
  subtotal: number;
  discount: { code: string; type: DiscountType; amount: number } | null;
  shipping: number;
  lines: {
    product_id: string;
    variant_id: string;
    title: string;
    variant_title: string | null;
    sku: string | null;
    image_url: string | null;
    quantity: number;
    price: number;
    attributes: LineAttribute[];
  }[];
};
