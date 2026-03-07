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

// Reports
export interface DashboardData {
  date: string;
  total_sales: number;
  transaction_count: number;
  avg_ticket: number;
  total_profit: number;
  yesterday_total: number;
  sales_by_hour: { hour: number; sales: number; transactions: number }[];
  top_products: TopProduct[];
  payment_breakdown: { cash: number; card: number; mixed: number };
}

export interface SalesPeriod {
  period: string;
  total_sales: number;
  transactions: number;
  avg_ticket: number;
}

export interface ProductProfit {
  product_id: string;
  product_name: string;
  units_sold: number;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: number;
}

export interface CategoryPerf {
  category: string;
  units_sold: number;
  revenue: number;
  products_count: number;
}

export interface CashierPerf {
  user_id: string;
  full_name: string;
  total_sales: number;
  transactions: number;
  avg_ticket: number;
  voided: number;
  items_sold: number;
}

export interface InventoryReport {
  total_products: number;
  total_stock_value: number;
  total_retail_value: number;
  potential_profit: number;
  out_of_stock_count: number;
  below_minimum_count: number;
  out_of_stock: InventoryItem[];
  below_minimum: InventoryItem[];
}

export interface InventoryItem {
  product_id: string;
  name: string;
  barcode: string;
  stock: number;
  min_stock: number;
  cost: number;
  price: number;
  reorder_qty: number;
}

// Finance
export interface FinanceEntry {
  id: string;
  entry_type: "income" | "expense";
  category: string;
  amount: number;
  description: string;
  image_path: string;
  date: string;
  created_at: string;
}

export interface FinanceSummary {
  total_income: number;
  total_expenses: number;
  balance: number;
  entry_count: number;
  expense_categories: { category: string; amount: number }[];
  income_categories: { category: string; amount: number }[];
}

export interface FinanceCategories {
  expense: string[];
  income: string[];
}
