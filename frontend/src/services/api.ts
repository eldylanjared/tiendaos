import type {
  AuthToken,
  Product,
  Category,
  Sale,
  DailySummary,
  SaleItemCreate,
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
  return request<Product>(`/products/barcode/${barcode}`);
}

export function getCategories() {
  return request<Category[]>("/products/categories");
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

export function getSales(date?: string, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (date) params.set("date", date);
  return request<Sale[]>(`/sales?${params}`);
}
