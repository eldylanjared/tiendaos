import { useEffect, useRef, useState } from "react";
import type { CartItem } from "@/types";

const cartKey = (item: CartItem) => `${item.product.id}-${item.pack_units}-${item.pack_price ?? ""}`;

interface Props {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  onUpdateQty: (productId: string, packUnits: number, packPrice: number | null, qty: number) => void;
  onRemove: (productId: string, packUnits: number, packPrice: number | null) => void;
  onClear: () => void;
  onPay: () => void;
}

export default function Cart({ items, subtotal, tax, total, onUpdateQty, onRemove, onClear, onPay }: Props) {
  const isWeight = (item: CartItem) => item.product.sell_by_weight;

  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevQty = useRef<Map<string, number>>(new Map());
  const [flashKey, setFlashKey] = useState<string | null>(null);

  // When a product is scanned (new row or quantity bump), scroll its row into
  // view and flash it so the cashier sees what the scanner did.
  useEffect(() => {
    const changed = items.find(
      (i) => (prevQty.current.get(cartKey(i)) ?? 0) < i.quantity
    );
    prevQty.current = new Map(items.map((i) => [cartKey(i), i.quantity]));
    if (!changed) return;
    const key = cartKey(changed);
    rowRefs.current.get(key)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setFlashKey(key);
    const t = setTimeout(() => setFlashKey(null), 600);
    return () => clearTimeout(t);
  }, [items]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Carrito</h2>
        {items.length > 0 && (
          <button style={styles.clearBtn} onClick={onClear}>Limpiar</button>
        )}
      </div>

      <div style={styles.items}>
        {items.length === 0 && (
          <p style={styles.empty}>Escanea o selecciona productos</p>
        )}
        {items.map((item) => {
          const key = cartKey(item);
          const unitPrice = item.pack_price ?? item.product.price;
          const promos = (item.product.volume_promos ?? [])
            .slice()
            .sort((a, b) => a.min_units - b.min_units)
            .map((vp) => `${vp.min_units}x$${vp.promo_price}`)
            .join(" | ");
          const tooltip = item.product.name + (promos ? `\nPromo: ${promos}` : "");
          return (
            <div
              key={key}
              ref={(el) => { el ? rowRefs.current.set(key, el) : rowRefs.current.delete(key); }}
              style={{ ...styles.item, ...(flashKey === key ? styles.itemFlash : {}) }}
              title={tooltip}
            >
              <div style={styles.itemName}>
                <span style={styles.itemNameText}>{item.product.name}</span>
                {item.pack_units > 1 && (
                  <span style={styles.packBadge}>x{item.pack_units}</span>
                )}
                {isWeight(item) && (
                  <span style={styles.weightBadge}>kg</span>
                )}
              </div>
              <span style={styles.itemPrice}>${unitPrice.toFixed(2)}</span>
              {isWeight(item) ? (
                <span style={styles.qtyVal}>{item.quantity.toFixed(3)} kg</span>
              ) : (
                <>
                  <button
                    style={styles.qtyBtn}
                    onClick={() => onUpdateQty(item.product.id, item.pack_units, item.pack_price, item.quantity - 1)}
                  >
                    −
                  </button>
                  <span style={styles.qtyVal}>{item.quantity}</span>
                  <button
                    style={styles.qtyBtn}
                    onClick={() => onUpdateQty(item.product.id, item.pack_units, item.pack_price, item.quantity + 1)}
                  >
                    +
                  </button>
                </>
              )}
              <span style={styles.lineTotal}>${item.line_total.toFixed(2)}</span>
              <button style={styles.removeBtn} onClick={() => onRemove(item.product.id, item.pack_units, item.pack_price)}>
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div style={styles.totals}>
        <div style={styles.totalRow}>
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div style={styles.totalRow}>
          <span>IVA (16%)</span>
          <span>${tax.toFixed(2)}</span>
        </div>
        <div style={{ ...styles.totalRow, ...styles.grandTotal }}>
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      <button
        style={{ ...styles.payBtn, ...(items.length === 0 ? styles.payBtnDisabled : {}) }}
        onClick={onPay}
        disabled={items.length === 0}
      >
        Cobrar ${total.toFixed(2)}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#fff",
    borderLeft: "1px solid #e2e8f0",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 16px 8px",
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" },
  clearBtn: {
    background: "none",
    border: "none",
    color: "#dc2626",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
  items: { flex: 1, overflowY: "auto", padding: "0 16px" },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 60, fontSize: 14 },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 0",
    borderBottom: "1px solid #f1f5f9",
    transition: "background 0.4s",
  },
  itemFlash: { background: "#dcfce7" },
  itemName: { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 4 },
  itemNameText: {
    fontSize: 13,
    fontWeight: 500,
    color: "#1e293b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  itemPrice: { fontSize: 11, color: "#64748b", flexShrink: 0 },
  packBadge: {
    fontSize: 10,
    fontWeight: 700,
    background: "#dbeafe",
    color: "#1e40af",
    padding: "1px 5px",
    borderRadius: 4,
  },
  weightBadge: {
    fontSize: 10,
    fontWeight: 700,
    background: "#fef3c7",
    color: "#92400e",
    padding: "1px 5px",
    borderRadius: 4,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    flexShrink: 0,
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#334155",
  },
  qtyVal: { fontSize: 13, fontWeight: 600, minWidth: 20, textAlign: "center", flexShrink: 0 },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
    flexShrink: 0,
    padding: "4px 2px",
  },
  lineTotal: { fontSize: 13, fontWeight: 600, color: "#0f172a", minWidth: 52, textAlign: "right", flexShrink: 0 },
  totals: { padding: "12px 16px", borderTop: "1px solid #e2e8f0" },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#64748b",
    marginBottom: 4,
  },
  grandTotal: { fontSize: 18, fontWeight: 700, color: "#0f172a", marginTop: 4, marginBottom: 0 },
  payBtn: {
    margin: "0 16px 16px",
    padding: "14px",
    borderRadius: 10,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  payBtnDisabled: { background: "#cbd5e1", cursor: "default" },
};
