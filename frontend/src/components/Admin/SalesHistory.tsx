import { useState, useEffect } from "react";
import { getSales, getDailySummary, voidSale } from "@/services/api";
import type { Sale, DailySummary } from "@/types";
import toast from "react-hot-toast";

export default function SalesHistory() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [date]);

  async function loadData() {
    try {
      const [salesData, summaryData] = await Promise.all([
        getSales(date, undefined, 200),
        getDailySummary(date),
      ]);
      setSales(salesData);
      setSummary(summaryData);
    } catch { /* ignore */ }
  }

  async function handleVoid(saleId: string) {
    try {
      await voidSale(saleId);
      toast.success("Venta anulada");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <div style={styles.toolbar}>
        <input
          type="date"
          style={styles.datePicker}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {summary && (
        <div style={styles.summaryCard}>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>Ventas Totales</span>
            <span style={styles.summaryValue}>${summary.total_sales.toFixed(2)}</span>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>Transacciones</span>
            <span style={styles.summaryValue}>{summary.transaction_count}</span>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>Ticket Promedio</span>
            <span style={styles.summaryValue}>${summary.avg_ticket.toFixed(2)}</span>
          </div>
        </div>
      )}

      <div style={styles.list}>
        {sales.map((sale) => (
          <div key={sale.id} style={styles.saleRow}>
            <div
              style={styles.saleHeader}
              onClick={() => setExpanded(expanded === sale.id ? null : sale.id)}
            >
              <div style={styles.saleInfo}>
                <span style={styles.saleTime}>
                  {new Date(sale.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span style={styles.saleId}>#{sale.id.slice(0, 8).toUpperCase()}</span>
                {sale.status === "voided" && <span style={styles.voidedTag}>ANULADA</span>}
              </div>
              <div style={styles.saleMeta}>
                <span style={styles.saleTotal}>${sale.total.toFixed(2)}</span>
                <span style={styles.salePayment}>{sale.payment_method}</span>
              </div>
            </div>

            {expanded === sale.id && (
              <div style={styles.saleDetail}>
                {sale.items.map((item) => (
                  <div key={item.id} style={styles.itemRow}>
                    <span>{item.quantity}{item.pack_units > 1 ? ` x${item.pack_units}` : ""} {item.product_name}</span>
                    <span>${item.line_total.toFixed(2)}</span>
                  </div>
                ))}
                <div style={styles.detailFooter}>
                  <span>Subtotal: ${sale.subtotal.toFixed(2)} | IVA: ${sale.tax.toFixed(2)}</span>
                  {sale.status === "completed" && (
                    <button style={styles.voidBtn} onClick={() => handleVoid(sale.id)}>Anular</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {sales.length === 0 && <p style={styles.empty}>No hay ventas para esta fecha</p>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { marginBottom: 12 },
  datePicker: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 14,
  },
  summaryCard: {
    display: "flex",
    gap: 16,
    marginBottom: 16,
    padding: 16,
    background: "#fff",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
  },
  summaryItem: { display: "flex", flexDirection: "column", gap: 2, flex: 1 },
  summaryLabel: { fontSize: 12, color: "#64748b", fontWeight: 500 },
  summaryValue: { fontSize: 22, fontWeight: 700, color: "#0f172a" },
  list: { display: "flex", flexDirection: "column", gap: 4 },
  saleRow: {
    background: "#fff",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    overflow: "hidden",
  },
  saleHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    cursor: "pointer",
  },
  saleInfo: { display: "flex", alignItems: "center", gap: 8 },
  saleTime: { fontSize: 13, fontWeight: 600, color: "#0f172a" },
  saleId: { fontSize: 11, color: "#94a3b8" },
  voidedTag: {
    fontSize: 10,
    fontWeight: 700,
    background: "#fef2f2",
    color: "#dc2626",
    padding: "1px 6px",
    borderRadius: 4,
  },
  saleMeta: { display: "flex", alignItems: "center", gap: 8 },
  saleTotal: { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  salePayment: { fontSize: 11, color: "#64748b", textTransform: "capitalize" as const },
  saleDetail: {
    padding: "0 14px 12px",
    borderTop: "1px solid #f1f5f9",
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#334155",
    padding: "4px 0",
  },
  detailFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTop: "1px solid #f1f5f9",
    fontSize: 12,
    color: "#64748b",
  },
  voidBtn: {
    padding: "4px 12px",
    borderRadius: 6,
    border: "1px solid #dc2626",
    background: "#fff",
    color: "#dc2626",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
};
