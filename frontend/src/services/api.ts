import type {
  AuthToken,
  Product,
  Category,
  Sale,
  DailySummary,
  SaleItemCreate,
  BarcodeLookupResult,
  User,
  StockAdjustment,
  PriceCheckResult,
} from "@/types";

const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// Auth
export function loginWithPin(pin_code: string) {
  return request<AuthToken>("/auth/pin-login", {
    method: "POST",
    body: JSON.stringify({ pin_code }),
  });
}

export function loginWithPassword(username: string, password: string) {
  return request<AuthToken>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  });
}

export function getMe() {
  return request<AuthToken["user"]>("/auth/me");
}

// Products
export function searchProducts(search: string = "", limit = 50) {
  const params = new URLSearchParams({ search, limit: String(limit) });
  return request<Product[]>(`/products?${params}`);
}

export function getByBarcode(barcode: string) {
  return request<BarcodeLookupResult>(`/products/barcode/${barcode}`);
}

export function getProduct(productId: string) {
  return request<Product>(`/products/${productId}`);
}

export function getCategories() {
  return request<Category[]>("/products/categories");
}

export function createProduct(data: Partial<Product> & { barcode: string; name: string; price: number }) {
  return request<Product>("/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProduct(productId: string, data: Record<string, unknown>) {
  return request<Product>(`/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function adjustStock(productId: string, quantity: number, reason: string, notes = "") {
  return request<StockAdjustment>(`/products/${productId}/adjust-stock`, {
    method: "POST",
    body: JSON.stringify({ quantity, reason, notes }),
  });
}

export function getStockHistory(productId: string) {
  return request<StockAdjustment[]>(`/products/${productId}/stock-history`);
}

export function addProductBarcode(productId: string, barcode: string, units: number, pack_price: number) {
  return request(`/products/${productId}/barcodes`, {
    method: "POST",
    body: JSON.stringify({ barcode, units, pack_price }),
  });
}

export function deleteProductBarcode(productId: string, barcodeId: string) {
  return request(`/products/${productId}/barcodes/${barcodeId}`, { method: "DELETE" });
}

export function addVolumePromo(productId: string, min_units: number, promo_price: number) {
  return request(`/products/${productId}/promos`, {
    method: "POST",
    body: JSON.stringify({ min_units, promo_price }),
  });
}

export function deleteVolumePromo(productId: string, promoId: string) {
  return request(`/products/${productId}/promos/${promoId}`, { method: "DELETE" });
}

// Sales
export function createSale(
  items: SaleItemCreate[],
  payment_method: string,
  cash_received: number
) {
  return request<Sale>("/sales", {
    method: "POST",
    body: JSON.stringify({ items, payment_method, cash_received }),
  });
}

export function getDailySummary(date?: string) {
  const params = date ? `?date=${date}` : "";
  return request<DailySummary>(`/sales/reports/daily${params}`);
}

export function getSales(date?: string, status?: string, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (date) params.set("date", date);
  if (status) params.set("status", status);
  return request<Sale[]>(`/sales?${params}`);
}

export function voidSale(saleId: string) {
  return request<Sale>(`/sales/${saleId}/void`, { method: "POST" });
}

// Admin — Users
export function getUsers() {
  return request<User[]>("/admin/users");
}

export function createUser(data: { username: string; full_name: string; password: string; pin_code: string; role: string; store_id: string }) {
  return request<User>("/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateUser(userId: string, data: Record<string, unknown>) {
  return request<User>(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// Price Checker (public, no auth)
export function priceCheck(barcode: string) {
  return request<PriceCheckResult>(`/price-check/${barcode}`);
}
