import { useState, useEffect, useCallback } from "react";
import { getPendingSales, removePendingSale } from "@/services/offlineDB";
import { createSale, searchProducts } from "@/services/api";

export interface OfflineSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
}

export function useOfflineSync(): OfflineSyncState {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Load initial pending count
  useEffect(() => {
    getPendingSales()
      .then((s) => setPendingCount(s.length))
      .catch(() => {});
  }, []);

  const flushQueue = useCallback(async () => {
    const pending = await getPendingSales().catch(() => []);
    if (!pending.length) return;

    setIsSyncing(true);
    for (const sale of pending) {
      try {
        await createSale(sale.items, sale.payment_method, sale.cash_received);
        await removePendingSale(sale.id);
      } catch {
        // Leave in queue if sync fails (e.g. server error) — try next session
      }
    }
    const remaining = await getPendingSales().catch(() => []);
    setPendingCount(remaining.length);
    setIsSyncing(false);
  }, []);

  const handleOnline = useCallback(async () => {
    setIsOnline(true);
    // Refresh product cache and flush pending sales
    searchProducts("", 5000).catch(() => {});
    await flushQueue();
  }, [flushQueue]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // If already online, try to flush any stale pending sales from a prior session
    if (navigator.onLine) {
      flushQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline, flushQueue]);

  return { isOnline, isSyncing, pendingCount };
}

// Lightweight hook for components that only need online status
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
