import type { Sale } from "@/types";

interface Props {
  sale: Sale;
  storeName: string;
  onClose: () => void;
}

export default function Receipt({ sale, storeName, onClose }: Props) {
  const date = new Date(sale.created_at);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.receipt}>
          <h3 style={styles.storeName}>{storeName}</h3>
          <p style={styles.date}>
            {date.toLocaleDateString("es-MX")} {date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <div style={styles.divider} />

          {sale.items.map((item) => (
            <div key={item.id} style={styles.lineItem}>
              <div style={styles.itemRow}>
                <span>{item.quantity}x {item.product_name}</span>
                <span>${item.line_total.toFixed(2)}</span>
              </div>
              {item.quantity > 1 && (
                <div style={styles.unitPrice}>${item.unit_price.toFixed(2)} c/u</div>
              )}
            </div>
          ))}

          <div style={styles.divider} />

          <div style={styles.sumRow}>
            <span>Subtotal</span><span>${sale.subtotal.toFixed(2)}</span>
          </div>
          <div style={styles.sumRow}>
            <span>IVA (16%)</span><span>${sale.tax.toFixed(2)}</span>
          </div>
          <div style={{ ...styles.sumRow, fontWeight: 700, fontSize: 16 }}>
            <span>TOTAL</span><span>${sale.total.toFixed(2)}</span>
          </div>

          <div style={styles.divider} />

          <div style={styles.sumRow}>
            <span>Pago ({sale.payment_method})</span><span>${sale.cash_received.toFixed(2)}</span>
          </div>
          {sale.change_given > 0 && (
            <div style={{ ...styles.sumRow, color: "#16a34a", fontWeight: 600 }}>
              <span>Cambio</span><span>${sale.change_given.toFixed(2)}</span>
            </div>
          )}

          <div style={styles.divider} />
          <p style={styles.thanks}>Gracias por su compra</p>
          <p style={styles.ticketId}>Ticket: {sale.id.slice(0, 8).toUpperCase()}</p>
        </div>

        <div style={styles.actions}>
          <button style={styles.printBtn} onClick={() => window.print()}>
            Imprimir
          </button>
          <button style={styles.doneBtn} onClick={onClose}>
            Nueva venta
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: { background: "#fff", borderRadius: 16, padding: 24, width: 340 },
  receipt: { fontFamily: "'Courier New', monospace", fontSize: 13 },
  storeName: { textAlign: "center", margin: "0 0 4px", fontSize: 16 },
  date: { textAlign: "center", color: "#64748b", margin: "0 0 8px", fontSize: 12 },
  divider: { borderTop: "1px dashed #cbd5e1", margin: "8px 0" },
  lineItem: { marginBottom: 4 },
  itemRow: { display: "flex", justifyContent: "space-between" },
  unitPrice: { fontSize: 11, color: "#94a3b8", paddingLeft: 16 },
  sumRow: { display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 },
  thanks: { textAlign: "center", margin: "8px 0 4px", fontSize: 12 },
  ticketId: { textAlign: "center", margin: 0, fontSize: 10, color: "#94a3b8" },
  actions: { display: "flex", gap: 8, marginTop: 16 },
  printBtn: {
    flex: 1,
    padding: "10px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  doneBtn: {
    flex: 1,
    padding: "10px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
};
