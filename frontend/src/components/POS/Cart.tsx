import type { CartItem } from "@/types";

interface Props {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  onUpdateQty: (productId: string, packUnits: number, qty: number) => void;
  onRemove: (productId: string, packUnits: number) => void;
  onClear: () => void;
  onPay: () => void;
}

export default function Cart({ items, subtotal, tax, total, onUpdateQty, onRemove, onClear, onPay }: Props) {
  const isWeight = (item: CartItem) => item.product.sell_by_weight;

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
          const key = `${item.product.id}-${item.pack_units}`;
          const unitPrice = item.pack_price ?? item.product.price;
          return (
            <div key={key} style={styles.item}>
              <div style={styles.itemInfo}>
                <div style={styles.itemName}>
                  {item.product.name}
                  {item.pack_units > 1 && (
                    <span style={styles.packBadge}>x{item.pack_units}</span>
                  )}
                  {isWeight(item) && (
                    <span style={styles.weightBadge}>kg</span>
                  )}
                </div>
                <div style={styles.itemPrice}>
                  ${unitPrice.toFixed(2)} {isWeight(item) ? "/kg" : "c/u"}
                </div>
              </div>
              <div style={styles.qtyRow}>
                {isWeight(item) ? (
                  <span style={styles.qtyVal}>{item.quantity.toFixed(3)} kg</span>
                ) : (
                  <>
                    <button
                      style={styles.qtyBtn}
                      onClick={() => onUpdateQty(item.product.id, item.pack_units, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span style={styles.qtyVal}>{item.quantity}</span>
                    <button
                      style={styles.qtyBtn}
                      onClick={() => onUpdateQty(item.product.id, item.pack_units, item.quantity + 1)}
                    >
                      +
                    </button>
                  </>
                )}
                <button style={styles.removeBtn} onClick={() => onRemove(item.product.id, item.pack_units)}>
                  ✕
                </button>
              </div>
              <div style={styles.lineTotal}>${item.line_total.toFixed(2)}</div>
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
    padding: "10px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  itemInfo: { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  itemName: { fontSize: 13, fontWeight: 500, color: "#1e293b", flex: 1, display: "flex", alignItems: "center", gap: 6 },
  itemPrice: { fontSize: 12, color: "#64748b" },
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
  qtyRow: { display: "flex", alignItems: "center", gap: 4, marginTop: 4 },
  qtyBtn: {
    width: 28,
    height: 28,
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
  qtyVal: { fontSize: 14, fontWeight: 600, minWidth: 24, textAlign: "center" },
  removeBtn: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
  },
  lineTotal: { textAlign: "right", fontSize: 14, fontWeight: 600, color: "#0f172a", marginTop: 2 },
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
