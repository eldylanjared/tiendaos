/**
 * IndexedDB service for offline-first support.
 * Stores product cache and pending sales queue.
 */
import type { Product, SaleItemCreate } from "@/types";

const DB_NAME = "tiendaos";
const DB_VERSION = 1;

export interface PendingSale {
  id: string;
  items: SaleItemCreate[];
  payment_method: string;
  cash_received: number;
  created_at: string;
}

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("products")) {
        db.createObjectStore("products", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("pendingSales")) {
        db.createObjectStore("pendingSales", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db!); };
    req.onerror = () => reject(req.error);
  });
}

function txPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// --- Products ---

export async function cacheProducts(products: Product[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("products", "readwrite");
  const store = tx.objectStore("products");
  store.clear();
  for (const p of products) store.put(p);
  await txPromise(tx);
  await setMeta("lastProductSync", new Date().toISOString());
}

export async function getCachedProducts(): Promise<Product[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("products", "readonly");
    const req = tx.objectStore("products").getAll();
    req.onsuccess = () => resolve(req.result as Product[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedProductByBarcode(barcode: string): Promise<Product | null> {
  const products = await getCachedProducts();
  // Check main barcode
  const direct = products.find((p) => p.barcode === barcode);
  if (direct) return direct;
  // Check pack barcodes
  const packed = products.find((p) =>
    p.barcodes?.some((b) => b.barcode === barcode)
  );
  return packed ?? null;
}

// --- Meta ---

async function setMeta(key: string, value: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put({ key, value });
  await txPromise(tx);
}

export async function getLastProductSync(): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve) => {
    const req = db.transaction("meta", "readonly").objectStore("meta").get("lastProductSync");
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => resolve(null);
  });
}

// --- Pending Sales ---

export async function queuePendingSale(sale: PendingSale): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("pendingSales", "readwrite");
  tx.objectStore("pendingSales").put(sale);
  await txPromise(tx);
}

export async function getPendingSales(): Promise<PendingSale[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("pendingSales", "readonly").objectStore("pendingSales").getAll();
    req.onsuccess = () => resolve(req.result as PendingSale[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removePendingSale(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("pendingSales", "readwrite");
  tx.objectStore("pendingSales").delete(id);
  await txPromise(tx);
}
