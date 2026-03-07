import { useEffect, useRef } from "react";
import { refreshTokenIfNeeded } from "@/services/api";

/**
 * Keeps the POS terminal alive:
 * 1. Auto-refreshes JWT token every 30 minutes (before 8hr expiry)
 * 2. Wake Lock API — prevents screen from sleeping
 * 3. Refreshes token when tab becomes visible again
 * 4. Refreshes token when network reconnects
 * 5. Warns before tab close (if enabled)
 */
export function useKeepAlive(options: { warnBeforeClose?: boolean } = {}) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    // --- 1. Token refresh every 30 minutes ---
    const refreshInterval = setInterval(() => {
      refreshTokenIfNeeded();
    }, 30 * 60 * 1000);

    // --- 2. Wake Lock API ---
    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
          wakeLockRef.current.addEventListener("release", () => {
            wakeLockRef.current = null;
          });
        }
      } catch {
        // Wake Lock denied or not supported — not critical
      }
    }
    requestWakeLock();

    // --- 3. Visibility change — re-acquire wake lock + refresh token ---
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshTokenIfNeeded();
        if (!wakeLockRef.current) {
          requestWakeLock();
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // --- 4. Network reconnect ---
    function handleOnline() {
      refreshTokenIfNeeded();
    }
    window.addEventListener("online", handleOnline);

    // --- 5. Warn before close ---
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (options.warnBeforeClose) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
      }
    };
  }, [options.warnBeforeClose]);
}
