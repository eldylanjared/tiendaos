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
  DashboardData,
  SalesPeriod,
  ProductProfit,
  CategoryPerf,
  CashierPerf,
  InventoryReport,
  FinanceEntry,
  FinanceSummary,
  FinanceCategories,
} from "@/types";

const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("token");
}

// Listeners for auth expiry — App.tsx hooks into this
type AuthExpiredCallback = () => void;
let onAuthExpired: AuthExpiredCallback | null = null;
export function setAuthExpiredHandler(cb: AuthExpiredCallback) {
  onAuthExpired = cb;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  _retry = true,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch (e) {
    // Network error — retry once after 2s
    if (_retry) {
      await new Promise((r) => setTimeout(r, 2000));
      return request<T>(path, options, false);
    }
    throw new Error("Sin conexión al servidor");
  }

  if (res.status === 401 && _retry && path !== "/auth/refresh") {
    // Try refreshing the token
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request<T>(path, options, false);
    }
    // Token truly expired — notify app
    onAuthExpired?.();
    throw new Error("Sesión expirada");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

async function tryRefreshToken(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return true;
  } catch {
    return false;
  }
}

// Proactive token refresh — call periodically
export async function refreshTokenIfNeeded(): Promise<boolean> {
  return tryRefreshToken();
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

export async function uploadProductImage(productId: string, file: File): Promise<{ image_url: string }> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/products/${productId}/image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Error al subir imagen");
  }
  return res.json();
}

export function exportProductsCsv() {
  const token = getToken();
  return fetch(`${BASE}/products/export-csv`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.blob());
}

export async function importProductsCsv(file: File): Promise<{ created: number; updated: number; errors: string[] }> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/products/import-csv`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Error al importar");
  }
  return res.json();
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

// Reports
export function getDashboard() {
  return request<DashboardData>("/reports/dashboard");
}

export function getSalesSummary(start?: string, end?: string, groupBy = "day") {
  const params = new URLSearchParams({ group_by: groupBy });
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return request<SalesPeriod[]>(`/reports/sales-summary?${params}`);
}

export function getProductProfitability(start?: string, end?: string, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return request<ProductProfit[]>(`/reports/product-profitability?${params}`);
}

export function getCategoryPerformance(start?: string, end?: string) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return request<CategoryPerf[]>(`/reports/category-performance?${params}`);
}

export function getCashierPerformance(start?: string, end?: string) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return request<CashierPerf[]>(`/reports/cashier-performance?${params}`);
}

export function getInventoryReport() {
  return request<InventoryReport>("/reports/inventory");
}

export function exportSalesCsv(start?: string, end?: string) {
  const token = getToken();
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return fetch(`${BASE}/reports/export/sales-csv?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.blob());
}

// Chat
export async function sendChatMessage(message: string, image?: File): Promise<{ reply: string; action: string | null; pending: boolean }> {
  const token = getToken();
  const form = new FormData();
  form.append("message", message);
  if (image) form.append("image", image);
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Error en chat");
  }
  return res.json();
}

// Finance
export function getFinanceEntries(start?: string, end?: string, entryType?: string) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  if (entryType) params.set("entry_type", entryType);
  return request<FinanceEntry[]>(`/finance?${params}`);
}

export function getFinanceSummary(start?: string, end?: string) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return request<FinanceSummary>(`/finance/summary?${params}`);
}

export function getFinanceCategories() {
  return request<FinanceCategories>("/finance/categories");
}

export async function createFinanceEntry(data: {
  entry_type: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  image?: File;
}): Promise<FinanceEntry> {
  const token = getToken();
  const form = new FormData();
  form.append("entry_type", data.entry_type);
  form.append("category", data.category);
  form.append("amount", String(data.amount));
  form.append("description", data.description);
  form.append("date", data.date);
  if (data.image) form.append("image", data.image);

  const res = await fetch(`${BASE}/finance`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Error al crear registro");
  }
  return res.json();
}

export function deleteFinanceEntry(entryId: string) {
  return request<{ ok: boolean }>(`/finance/${entryId}`, { method: "DELETE" });
}

export function getFinanceImageUrl(filename: string) {
  return `${BASE}/finance/image/${filename}`;
}

export async function scanReceipt(image: File): Promise<{
  entry_type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  date: string;
  raw_text: string;
  confidence: string;
}> {
  const token = getToken();
  const form = new FormData();
  form.append("image", image);
  const res = await fetch(`${BASE}/finance/scan-receipt`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Error al procesar imagen");
  }
  return res.json();
}
