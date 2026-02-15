export interface Category {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
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
  created_at: string;
  updated_at: string;
  category: Category | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount_percent: number;
  line_total: number;
}

export interface SaleItemCreate {
  product_id: string;
  quantity: number;
  discount_percent: number;
}

export interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_total: number;
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
