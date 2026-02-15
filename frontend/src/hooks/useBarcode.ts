import { useEffect, useRef } from "react";

/**
 * Listens for rapid keystrokes from a barcode scanner.
 * Scanners type characters fast then press Enter.
 * Calls onScan with the scanned barcode string.
 */
export function useBarcode(onScan: (barcode: string) => void, enabled = true) {
  const buffer = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!enabled) return;

    function handleKey(e: KeyboardEvent) {
      // Ignore if typing in an input field (except barcode-dedicated ones)
      const tag = (e.target as HTMLElement).tagName;
      const isBarcodeInput = (e.target as HTMLElement).dataset.barcode === "true";
      if ((tag === "INPUT" || tag === "TEXTAREA") && !isBarcodeInput) return;

      if (e.key === "Enter" && buffer.current.length >= 4) {
        e.preventDefault();
        onScan(buffer.current);
        buffer.current = "";
        return;
      }

      if (e.key.length === 1) {
        buffer.current += e.key;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          buffer.current = "";
        }, 100); // scanners type within ~50ms between chars
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      clearTimeout(timer.current);
    };
  }, [onScan, enabled]);
}
