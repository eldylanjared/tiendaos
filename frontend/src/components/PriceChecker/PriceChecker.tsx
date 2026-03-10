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
    <>
      <style>{responsiveCSS}</style>
      <div className="pc-container">
        <div className="pc-header">
          <span className="pc-logo">TiendaOS</span>
          <span className="pc-subtitle">Consulta de Precios</span>
        </div>

        <div className="pc-content">
          {!product && !error && !loading && (
            <div className="pc-idle">
              <svg className="pc-scan-icon" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
                <line x1="7" y1="8" x2="7" y2="16" />
                <line x1="10" y1="8" x2="10" y2="16" />
                <line x1="13" y1="8" x2="13" y2="16" />
                <line x1="16" y1="8" x2="16" y2="16" />
              </svg>
              <p className="pc-idle-text">Escanea un producto para ver su precio</p>
            </div>
          )}

          {loading && <p className="pc-loading">Buscando...</p>}

          {error && (
            <div className="pc-error-box">
              <p className="pc-error-text">{error}</p>
            </div>
          )}

          {product && (
            <div className="pc-card">
              <div className="pc-card-img">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="pc-product-img" />
                ) : (
                  <div className="pc-img-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" className="pc-placeholder-svg">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="pc-card-info">
                <h1 className="pc-product-name">{product.name}</h1>
                {product.pack && (
                  <p className="pc-pack-label">Pack x{product.pack.units}</p>
                )}
                <div className="pc-price-box">
                  <span className="pc-currency">$</span>
                  <span className="pc-price-main">{Math.floor(product.price)}</span>
                  <span className="pc-price-cents">
                    .{((product.price % 1) * 100).toFixed(0).padStart(2, "0")}
                  </span>
                  {product.sell_by_weight && <span className="pc-per-kg">/kg</span>}
                </div>
                {product.pack && (
                  <p className="pc-unit-note">
                    Precio unitario: ${product.unit_price.toFixed(2)}
                  </p>
                )}
                {product.volume_promos && product.volume_promos.length > 0 && (
                  <div className="pc-promo-list">
                    {product.volume_promos.map((vp, i) => (
                      <span key={i} className="pc-promo-badge">
                        {vp.min_units} x ${vp.bundle_price.toFixed(2)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const responsiveCSS = `
.pc-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #f8fafc;
  overflow: hidden;
  box-sizing: border-box;
}
.pc-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2vh 3vw;
  background: #0f172a;
  color: #fff;
  flex-shrink: 0;
}
.pc-logo { font-weight: 700; font-size: clamp(14px, 2.5vw, 20px); }
.pc-subtitle { font-size: clamp(11px, 2vw, 16px); color: #94a3b8; }

.pc-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3vh 3vw;
  overflow: hidden;
  min-height: 0;
}

/* Idle state */
.pc-idle { text-align: center; }
.pc-scan-icon { width: clamp(60px, 15vh, 120px); height: clamp(60px, 15vh, 120px); }
.pc-idle-text { font-size: clamp(14px, 2.5vh, 22px); color: #94a3b8; margin: 2vh 0 0; }
.pc-loading { font-size: clamp(14px, 2.5vh, 20px); color: #64748b; }
.pc-error-box { text-align: center; }
.pc-error-text { font-size: clamp(16px, 3vh, 24px); color: #dc2626; }

/* Product card */
.pc-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  background: #fff;
  border-radius: clamp(10px, 2vh, 20px);
  padding: clamp(12px, 3vh, 40px);
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  max-width: 95vw;
  max-height: 85vh;
  width: 100%;
  gap: clamp(12px, 3vw, 40px);
  overflow: hidden;
  box-sizing: border-box;
}
.pc-card-img { flex-shrink: 0; }
.pc-product-img {
  width: clamp(80px, 22vh, 200px);
  height: clamp(80px, 22vh, 200px);
  object-fit: contain;
  border-radius: clamp(6px, 1vh, 12px);
}
.pc-img-placeholder {
  width: clamp(80px, 22vh, 200px);
  height: clamp(80px, 22vh, 200px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border-radius: clamp(6px, 1vh, 12px);
}
.pc-placeholder-svg {
  width: clamp(40px, 10vh, 80px);
  height: clamp(40px, 10vh, 80px);
}

.pc-card-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.pc-product-name {
  font-size: clamp(16px, 4vh, 32px);
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 1vh;
  word-break: break-word;
  overflow-wrap: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.2;
}
.pc-pack-label {
  font-size: clamp(12px, 2vh, 18px);
  font-weight: 600;
  color: #1e40af;
  background: #dbeafe;
  display: inline-block;
  padding: 0.5vh 1.5vw;
  border-radius: 6px;
  margin: 0 0 1vh;
}
.pc-price-box {
  display: flex;
  align-items: baseline;
  gap: 2px;
  margin-top: 1vh;
}
.pc-currency { font-size: clamp(20px, 5vh, 36px); font-weight: 700; color: #16a34a; }
.pc-price-main { font-size: clamp(36px, 10vh, 80px); font-weight: 800; color: #16a34a; line-height: 1; }
.pc-price-cents { font-size: clamp(16px, 4vh, 36px); font-weight: 700; color: #16a34a; align-self: flex-start; margin-top: 0.5vh; }
.pc-per-kg { font-size: clamp(12px, 2.5vh, 22px); color: #64748b; margin-left: 4px; }
.pc-unit-note { font-size: clamp(11px, 1.8vh, 16px); color: #64748b; margin-top: 1vh; }

.pc-promo-list { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 1.5vh; }
.pc-promo-badge {
  font-size: clamp(12px, 2vh, 18px);
  font-weight: 700;
  padding: 0.5vh 1.5vw;
  border-radius: 6px;
  background: #dcfce7;
  color: #16a34a;
}

/* Portrait / very small screens — stack vertically */
@media (max-aspect-ratio: 3/4) {
  .pc-card {
    flex-direction: column;
    text-align: center;
    gap: clamp(8px, 2vh, 20px);
    padding: clamp(8px, 2vh, 24px);
  }
  .pc-price-box { justify-content: center; }
  .pc-promo-list { justify-content: center; }
}
`;
