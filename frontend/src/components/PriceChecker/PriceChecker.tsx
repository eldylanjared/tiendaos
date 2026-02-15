import { useState, useEffect, useRef, useCallback } from "react";
import { useBarcode } from "@/hooks/useBarcode";
import { priceCheck, getByBarcode } from "@/services/api";
import { isLoggedIn } from "@/store/auth";
import type { PriceCheckResult } from "@/types";

interface Props {
  storeName: string;
}

const AUTO_CLEAR_MS = 15_000;

export default function PriceChecker({ storeName }: Props) {
  const [product, setProduct] = useState<PriceCheckResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setProduct(null);
      setError("");
    }, AUTO_CLEAR_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleScan = useCallback(
    async (barcode: string) => {
      setLoading(true);
      setError("");
      try {
        if (isLoggedIn()) {
          // Authenticated mode — use barcode lookup
          const result = await getByBarcode(barcode);
          const p = result.product;
          setProduct({
            name: p.name,
            price: result.pack ? result.pack.pack_price : p.price,
            unit_price: p.price,
            image_url: p.image_url,
            sell_by_weight: p.sell_by_weight,
            pack: result.pack
              ? { barcode: result.pack.barcode, units: result.pack.units, pack_price: result.pack.pack_price }
              : null,
          });
        } else {
          // Kiosk mode — public endpoint
          const result = await priceCheck(barcode);
          setProduct(result);
        }
        resetTimer();
      } catch {
        setProduct(null);
        setError("Producto no encontrado");
        resetTimer();
      } finally {
        setLoading(false);
      }
    },
    [resetTimer]
  );

  useBarcode(handleScan);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.logo}>TiendaOS</span>
        <span style={styles.subtitle}>Consulta de Precios</span>
      </div>

      <div style={styles.content}>
        {!product && !error && !loading && (
          <div style={styles.idle}>
            <div style={styles.scanIcon}>
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
                <line x1="7" y1="8" x2="7" y2="16" />
                <line x1="10" y1="8" x2="10" y2="16" />
                <line x1="13" y1="8" x2="13" y2="16" />
                <line x1="16" y1="8" x2="16" y2="16" />
              </svg>
            </div>
            <p style={styles.idleText}>Escanea un producto para ver su precio</p>
          </div>
        )}

        {loading && <p style={styles.loading}>Buscando...</p>}

        {error && (
          <div style={styles.errorBox}>
            <p style={styles.errorText}>{error}</p>
          </div>
        )}

        {product && (
          <div style={styles.productCard}>
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} style={styles.productImage} />
            ) : (
              <div style={styles.imagePlaceholder}>
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            )}
            <h1 style={styles.productName}>{product.name}</h1>
            {product.pack && (
              <p style={styles.packLabel}>Pack x{product.pack.units}</p>
            )}
            <div style={styles.priceBox}>
              <span style={styles.currency}>$</span>
              <span style={styles.priceMain}>{Math.floor(product.price)}</span>
              <span style={styles.priceCents}>
                .{((product.price % 1) * 100).toFixed(0).padStart(2, "0")}
              </span>
              {product.sell_by_weight && <span style={styles.perKg}>/kg</span>}
            </div>
            {product.pack && (
              <p style={styles.unitPriceNote}>
                Precio unitario: ${product.unit_price.toFixed(2)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    background: "#f8fafc",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 24px",
    background: "#0f172a",
    color: "#fff",
  },
  logo: { fontWeight: 700, fontSize: 18 },
  subtitle: { fontSize: 14, color: "#94a3b8" },
  content: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  idle: { textAlign: "center" },
  scanIcon: { marginBottom: 16 },
  idleText: { fontSize: 20, color: "#94a3b8", margin: 0 },
  loading: { fontSize: 18, color: "#64748b" },
  errorBox: { textAlign: "center" },
  errorText: { fontSize: 20, color: "#dc2626" },
  productCard: {
    textAlign: "center",
    background: "#fff",
    borderRadius: 20,
    padding: "40px 60px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
    maxWidth: 500,
    width: "100%",
  },
  productImage: {
    width: 200,
    height: 200,
    objectFit: "contain",
    marginBottom: 16,
    borderRadius: 12,
  },
  imagePlaceholder: {
    width: 200,
    height: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
    borderRadius: 12,
    margin: "0 auto 16px",
  },
  productName: {
    fontSize: 28,
    fontWeight: 700,
    color: "#0f172a",
    margin: "0 0 8px",
  },
  packLabel: {
    fontSize: 16,
    fontWeight: 600,
    color: "#1e40af",
    background: "#dbeafe",
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: 8,
    margin: "0 0 12px",
  },
  priceBox: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 2,
    marginTop: 8,
  },
  currency: { fontSize: 32, fontWeight: 700, color: "#16a34a" },
  priceMain: { fontSize: 72, fontWeight: 800, color: "#16a34a", lineHeight: 1 },
  priceCents: { fontSize: 32, fontWeight: 700, color: "#16a34a", alignSelf: "flex-start", marginTop: 8 },
  perKg: { fontSize: 20, color: "#64748b", marginLeft: 4 },
  unitPriceNote: { fontSize: 14, color: "#64748b", marginTop: 8 },
};
