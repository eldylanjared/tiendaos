import { useState } from "react";
import { createSale } from "@/services/api";
import type { Sale, SaleItemCreate } from "@/types";

interface Props {
  total: number;
  items: SaleItemCreate[];
  onComplete: (sale: Sale) => void;
  onClose: () => void;
}

export default function PaymentModal({ total, items, onComplete, onClose }: Props) {
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [cashInput, setCashInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cashAmount = parseFloat(cashInput) || 0;
  const change = Math.max(cashAmount - total, 0);
  const canPay = method === "card" || cashAmount >= total;

  const quickAmounts = [
    Math.ceil(total),
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
  ].filter((v, i, a) => v >= total && a.indexOf(v) === i).slice(0, 4);

  async function handlePay() {
    setLoading(true);
    setError("");
    try {
      const sale = await createSale(items, method, method === "card" ? total : cashAmount);
      onComplete(sale);
    } catch (e: any) {
      setError(e.message || "Error al procesar venta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Cobrar</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.totalDisplay}>
          <span style={styles.totalLabel}>Total a cobrar</span>
          <span style={styles.totalAmount}>${total.toFixed(2)} MXN</span>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.methodRow}>
          <button
            style={{ ...styles.methodBtn, ...(method === "cash" ? styles.methodActive : {}) }}
            onClick={() => setMethod("cash")}
          >
            Efectivo
          </button>
          <button
            style={{ ...styles.methodBtn, ...(method === "card" ? styles.methodActive : {}) }}
            onClick={() => setMethod("card")}
          >
            Tarjeta
          </button>
        </div>

        {method === "cash" && (
          <>
            <input
              style={styles.cashInput}
              type="number"
              placeholder="Monto recibido"
              value={cashInput}
              onChange={(e) => setCashInput(e.target.value)}
              autoFocus
              step="0.01"
            />
            <div style={styles.quickRow}>
              {quickAmounts.map((amt) => (
                <button key={amt} style={styles.quickBtn} onClick={() => setCashInput(String(amt))}>
                  ${amt}
                </button>
              ))}
            </div>
            {cashAmount >= total && (
              <div style={styles.changeDisplay}>
                Cambio: <strong>${change.toFixed(2)}</strong>
              </div>
            )}
          </>
        )}

        {method === "card" && (
          <div style={styles.cardMsg}>
            Procesa el pago en la terminal Bancomer y confirma
          </div>
        )}

        <button
          style={{ ...styles.payBtn, ...(!canPay ? styles.payBtnDisabled : {}) }}
          disabled={!canPay || loading}
          onClick={handlePay}
        >
          {loading ? "Procesando..." : `Confirmar pago $${total.toFixed(2)}`}
        </button>
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
  modal: {
    background: "#fff",
    borderRadius: 16,
    padding: 28,
    width: 380,
    maxHeight: "90vh",
    overflowY: "auto",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { margin: 0, fontSize: 20, fontWeight: 700 },
  closeBtn: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" },
  totalDisplay: { textAlign: "center", marginBottom: 20 },
  totalLabel: { display: "block", fontSize: 13, color: "#64748b", marginBottom: 4 },
  totalAmount: { fontSize: 32, fontWeight: 700, color: "#0f172a" },
  error: { background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13 },
  methodRow: { display: "flex", gap: 8, marginBottom: 16 },
  methodBtn: {
    flex: 1,
    padding: "10px",
    borderRadius: 8,
    border: "2px solid #e2e8f0",
    background: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    color: "#64748b",
  },
  methodActive: { borderColor: "#2563eb", color: "#2563eb", background: "#eff6ff" },
  cashInput: {
    width: "100%",
    padding: "14px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 20,
    fontWeight: 600,
    textAlign: "center",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 8,
  },
  quickRow: { display: "flex", gap: 6, marginBottom: 12 },
  quickBtn: {
    flex: 1,
    padding: "8px 4px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  changeDisplay: {
    textAlign: "center",
    fontSize: 18,
    color: "#16a34a",
    padding: "12px",
    background: "#f0fdf4",
    borderRadius: 8,
    marginBottom: 12,
  },
  cardMsg: {
    textAlign: "center",
    color: "#64748b",
    padding: "20px 12px",
    fontSize: 14,
    background: "#f8fafc",
    borderRadius: 8,
    marginBottom: 12,
  },
  payBtn: {
    width: "100%",
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
