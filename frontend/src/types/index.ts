export interface Category {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
}

export interface ProductBarcode {
  id: string;
  product_id: string;
  barcode: string;
  units: number;
  pack_price: number;
}

export interface VolumePromo {
  id: string;
  product_id: string;
  min_units: number;
  promo_price: number;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  description: string;
  category_id: string | null;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  image_url: string;
  is_active: boolean;
  sell_by_weight: boolean;
  created_at: string;
  updated_at: string;
  category: Category | null;
  barcodes: ProductBarcode[];
  volume_promos: VolumePromo[];
}

export interface PackInfo {
  barcode_id: string;
  barcode: string;
  units: number;
  pack_price: number;
}

export interface BarcodeLookupResult {
  product: Product;
  pack: PackInfo | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount_percent: number;
  line_total: number;
  pack_units: number;
  pack_price: number | null;
}

export interface SaleItemCreate {
  product_id: string;
  quantity: number;
  discount_percent: number;
  pack_units: number;
}

export interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_total: number;
  pack_units: number;
}

export interface Sale {
  id: string;
  store_id: string;
  user_id: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  payment_method: string;
  cash_received: number;
  change_given: number;
  status: string;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: string;
  store_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  user: User;
}

export interface TopProduct {
  product_name: string;
  quantity_sold: number;
  revenue: number;
}

export interface DailySummary {
  date: string;
  total_sales: number;
  transaction_count: number;
  avg_ticket: number;
  top_products: TopProduct[];
}

export interface StockAdjustment {
  id: string;
  product_id: string;
  user_id: string;
  quantity: number;
  reason: string;
  notes: string;
  created_at: string;
}

export interface PriceCheckResult {
  name: string;
  price: number;
  unit_price: number;
  image_url: string;
  sell_by_weight: boolean;
  pack: { barcode: string; units: number; pack_price: number } | null;
}
