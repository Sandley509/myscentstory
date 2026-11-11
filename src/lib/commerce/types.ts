/**
 * Storefront types. Shapes are kept identical to the old Shopify layer so
 * every component keeps working unchanged — only the data source moved to
 * Supabase.
 */
export type Maybe<T> = T | null;

export type Connection<T> = {
  edges: Array<Edge<T>>;
};

export type Edge<T> = {
  node: T;
};

export type Money = {
  amount: string;
  currencyCode: string;
};

export type Image = {
  url: string;
  altText: string;
  width: number;
  height: number;
};

export type SEO = {
  title: string;
  description: string;
};

export type ProductOption = {
  id: string;
  name: string;
  values: string[];
};

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: {
    name: string;
    value: string;
  }[];
  price: Money;
  /** Original price when the variant is on sale (always higher than `price`). */
  compareAtPrice: Money | null;
  sku: string | null;
  /** UPC / EAN / GTIN — sent to Google and Meta as `gtin`. */
  barcode: string | null;
};

export type Gender = 'female' | 'male' | 'unisex';

export type FragranceNotes = {
  top: string[];
  heart: string[];
  base: string[];
};

export type BaseProduct = {
  id: string;
  handle: string;
  availableForSale: boolean;
  title: string;
  description: string;
  descriptionHtml: string;
  options: ProductOption[];
  priceRange: {
    maxVariantPrice: Money;
    minVariantPrice: Money;
  };
  variants: Connection<ProductVariant>;
  featuredImage: Image;
  images: Connection<Image>;
  seo: SEO;
  tags: string[];
  /** Brand / house (the admin's "Vendor" field). */
  vendor: string | null;
  productType: string | null;
  gender: Gender | null;
  /** "Eau de Parfum", "Eau de Toilette"… */
  concentration: string | null;
  scentFamily: string | null;
  notes: FragranceNotes;
  totalSold: number;
  createdAt: string;
  updatedAt: string;
};

export type Product = Omit<BaseProduct, 'variants' | 'images'> & {
  variants: ProductVariant[];
  images: Image[];
};

export type BaseCollection = {
  handle: string;
  title: string;
  description: string;
  /** The collection image uploaded in the admin (may be null). */
  image?: Image | null;
  seo: SEO;
  updatedAt: string;
};

export type Collection = BaseCollection & {
  path: string;
};

export type CartProduct = {
  id: string;
  handle: string;
  title: string;
  featuredImage: Image;
  /**
   * Product tags — already returned by the cart query's product fragment.
   * Used for tag-gated rules such as `restricted-alcohol` delivery limits.
   */
  tags?: string[];
};

export type CartAttribute = {
  key: string;
  value: string | null;
};

export type CartItem = {
  id: string | undefined;
  quantity: number;
  attributes?: CartAttribute[];
  cost: {
    totalAmount: Money;
  };
  merchandise: {
    id: string;
    title: string;
    selectedOptions: {
      name: string;
      value: string;
    }[];
    product: CartProduct;
  };
};

export type BaseCart = {
  id: string | undefined;
  checkoutUrl: string;
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
    totalTaxAmount: Money;
  };
  lines: Connection<CartItem>;
  totalQuantity: number;
};

export type Cart = Omit<BaseCart, 'lines'> & {
  lines: CartItem[];
  /** Discount code applied to the cart (validated again at checkout). */
  discountCode?: string | null;
  /** Estimated saving from `discountCode` (0 for free-shipping codes). */
  discountAmount?: Money | null;
  /** Email given for a first-order / once-per-customer code; checkout uses it. */
  email?: string | null;
};

export type Menu = {
  title: string;
  path: string;
};


export type Page = {
  id: string;
  title: string;
  handle: string;
  body: string;
  bodySummary: string;
  seo?: SEO;
  createdAt: string;
  updatedAt: string;
};


/** A single custom attribute (line item property) on a cart line. */
export type AttributeInput = {
  key: string;
  value: string;
};

export type CartLineInput = {
  merchandiseId: string;
  quantity: number;
  attributes?: AttributeInput[];
};
