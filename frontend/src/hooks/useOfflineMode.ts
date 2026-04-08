import { useState, useEffect, useCallback } from "react";
import type { Product, SaleItemCreate } from "@/types";

const PRODUCTS_CACHE_KEY = "tiendaos_products_cache";
const OFFLINE_SALES_KEY = "tiendaos_offline_sales";

export interface OfflineSale {
  id: string;
  items: SaleItemCreate[];
  total: number;
  payment_method: string;
  cash_received: number;
  created_at: string;
}

export function useOfflineMode() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const cacheProducts = useCallback((products: Product[]) => {
    try {
      localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
    } catch {
      // storage full — ignore
    }
  }, []);

  const getCachedProducts = useCallback((): Product[] => {
    try {
      const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  const queueOfflineSale = useCallback((sale: Omit<OfflineSale, "id" | "created_at">) => {
    try {
      const existing: OfflineSale[] = JSON.parse(localStorage.getItem(OFFLINE_SALES_KEY) || "[]");
      const newSale: OfflineSale = {
        ...sale,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify([...existing, newSale]));
      return newSale;
    } catch {
      return null;
    }
  }, []);

  const getPendingOfflineSales = useCallback((): OfflineSale[] => {
    try {
      return JSON.parse(localStorage.getItem(OFFLINE_SALES_KEY) || "[]");
    } catch {
      return [];
    }
  }, []);

  const clearOfflineSales = useCallback(() => {
    localStorage.removeItem(OFFLINE_SALES_KEY);
  }, []);

  const pendingCount = getPendingOfflineSales().length;

  return {
    isOnline,
    cacheProducts,
    getCachedProducts,
    queueOfflineSale,
    getPendingOfflineSales,
    clearOfflineSales,
    pendingCount,
  };
}
