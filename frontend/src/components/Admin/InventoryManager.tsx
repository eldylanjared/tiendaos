import { useState, useEffect } from "react";
import { searchProducts, adjustStock, getInventoryReport } from "@/services/api";
import type { Product, InventoryReport } from "@/types";
import toast from "react-hot-toast";

type InvView = "overview" | "adjust";

export default function InventoryManager() {
  const [invView, setInvView] = useState<InvView>("overview");
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjQty, setAdjQty] = useState(0);
  const [adjReason, setAdjReason] = useState("restock");
  const [adjNotes, setAdjNotes] = useState("");

  useEffect(() => {
    loadReport();
    loadProducts();
  }, []);

  async function loadReport() {
    try { setReport(await getInventoryReport()); } catch { /* ignore */ }
  }

  async function loadProducts() {
    try {
      const all = await searchProducts("", 200);
      all.sort((a, b) => {
        const urgA = a.stock <= a.min_stock ? 0 : 1;
        const urgB = b.stock <= b.min_stock ? 0 : 1;
        if (urgA !== urgB) return urgA - urgB;
        return a.stock - b.stock;
      });
      setProducts(all);
    } catch { /* ignore */ }
  }

  async function handleAdjust(productId: string) {
    if (adjQty === 0) return;
    try {
      await adjustStock(productId, adjQty, adjReason, adjNotes);
      toast.success("Inventario ajustado");
      setAdjusting(null);
      setAdjQty(0);
      setAdjReason("restock");
      setAdjNotes("");
      loadProducts();
      loadReport();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <div style={styles.viewToggle}>
        <button style={invView === "overview" ? { ...styles.togBtn, ...styles.togBtnActive } : styles.togBtn} onClick={() => setInvView("overview")}>
          Resumen
        </button>
        <button style={invView === "adjust" ? { ...styles.togBtn, ...styles.togBtnActive } : styles.togBtn} onClick={() => setInvView("adjust")}>
          Ajustar Stock
        </button>
      </div>

      {invView === "overview" && report && (
        <div>
          {/* KPI cards */}
          <div style={styles.kpiRow}>
            <div style={styles.kpiCard}>
              <span style={styles.kpiLabel}>Productos Activos</span>
              <span style={styles.kpiValue}>{report.total_products}</span>
            </div>
            <div style={styles.kpiCard}>
              <span style={styles.kpiLabel}>Valor en Costo</span>
              <span style={styles.kpiValue}>${report.total_stock_value.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={styles.kpiCard}>
              <span style={styles.kpiLabel}>Valor en Precio</span>
              <span style={styles.kpiValue}>${report.total_retail_value.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={styles.kpiCard}>
              <span style={styles.kpiLabel}>Ganancia Potencial</span>
              <span style={{ ...styles.kpiValue, color: "#16a34a" }}>${report.potential_profit.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Alert summary */}
          <div style={styles.alertRow}>
            <div style={{ ...styles.alertCard, borderLeftColor: "#dc2626" }}>
              <span style={styles.alertCount}>{report.out_of_stock_count}</span>
              <span style={styles.alertLabel}>Sin Stock</span>
            </div>
            <div style={{ ...styles.alertCard, borderLeftColor: "#f59e0b" }}>
              <span style={styles.alertCount}>{report.below_minimum_count}</span>
              <span style={styles.alertLabel}>Bajo Minimo</span>
            </div>
          </div>

          {/* Out of stock list */}
          {report.out_of_stock.length > 0 && (
            <div style={styles.section}>
              <h4 style={styles.sectionTitle}>Sin Stock — Reordenar</h4>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Producto</th>
                    <th style={styles.th}>Codigo</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Stock</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Minimo</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Sugerido</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Costo Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {report.out_of_stock.map((item) => (
                    <tr key={item.product_id} style={styles.tr}>
                      <td style={styles.td}>{item.name}</td>
                      <td style={{ ...styles.td, fontSize: 11, color: "#94a3b8" }}>{item.barcode}</td>
                      <td style={{ ...styles.td, textAlign: "right", color: "#dc2626", fontWeight: 600 }}>{item.stock}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>{item.min_stock}</td>
                      <td style={{ ...styles.td, textAlign: "right", fontWeight: 600 }}>{item.reorder_qty}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>${(item.cost * item.reorder_qty).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Below minimum list */}
          {report.below_minimum.length > 0 && (
            <div style={styles.section}>
              <h4 style={styles.sectionTitle}>Bajo Minimo</h4>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Producto</th>
                    <th style={styles.th}>Codigo</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Stock</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Minimo</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Sugerido</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Costo Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {report.below_minimum.map((item) => (
                    <tr key={item.product_id} style={styles.tr}>
                      <td style={styles.td}>{item.name}</td>
                      <td style={{ ...styles.td, fontSize: 11, color: "#94a3b8" }}>{item.barcode}</td>
                      <td style={{ ...styles.td, textAlign: "right", color: "#f59e0b", fontWeight: 600 }}>{item.stock}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>{item.min_stock}</td>
                      <td style={{ ...styles.td, textAlign: "right", fontWeight: 600 }}>{item.reorder_qty}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>${(item.cost * item.reorder_qty).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {invView === "adjust" && (
        <div style={styles.list}>
          {products.map((p) => {
            const isLow = p.stock <= p.min_stock;
            const isCritical = p.stock === 0;
            return (
              <div key={p.id} style={styles.row}>
                <div style={styles.rowInfo}>
                  <div style={styles.rowTop}>
                    <span style={styles.rowName}>{p.name}</span>
                    {isCritical && <span style={styles.criticalTag}>SIN STOCK</span>}
                    {!isCritical && isLow && <span style={styles.lowTag}>BAJO</span>}
                  </div>
                  <div style={styles.stockBar}>
                    <div
                      style={{
                        ...styles.stockFill,
                        width: `${Math.min((p.stock / Math.max(p.min_stock * 3, 1)) * 100, 100)}%`,
                        background: isCritical ? "#dc2626" : isLow ? "#f59e0b" : "#16a34a",
                      }}
                    />
                  </div>
                  <span style={styles.stockText}>
                    {p.stock} / min {p.min_stock}
                  </span>
                </div>

                {adjusting === p.id ? (
                  <div style={styles.adjForm}>
                    <input
                      style={styles.adjInput}
                      type="number"
                      placeholder="+/- cantidad"
                      value={adjQty || ""}
                      onChange={(e) => setAdjQty(parseInt(e.target.value) || 0)}
                    />
                    <select style={styles.adjSelect} value={adjReason} onChange={(e) => setAdjReason(e.target.value)}>
                      <option value="restock">Reabastecimiento</option>
                      <option value="damaged">Merma/Danado</option>
                      <option value="correction">Correccion</option>
                      <option value="shrinkage">Faltante</option>
                    </select>
                    <input
                      style={styles.adjInput}
                      placeholder="Notas (opcional)"
                      value={adjNotes}
                      onChange={(e) => setAdjNotes(e.target.value)}
                    />
                    <button style={styles.adjSave} onClick={() => handleAdjust(p.id)}>OK</button>
                    <button style={styles.adjCancel} onClick={() => setAdjusting(null)}>X</button>
                  </div>
                ) : (
                  <button style={styles.adjBtn} onClick={() => setAdjusting(p.id)}>Ajustar</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  viewToggle: { display: "flex", gap: 4, marginBottom: 12 },
  togBtn: {
    padding: "6px 14px", borderRadius: 6, border: "1px solid #e2e8f0",
    background: "#fff", color: "#64748b", cursor: "pointer", fontSize: 12, fontWeight: 500,
  },
  togBtnActive: { background: "#0f172a", color: "#fff", borderColor: "#0f172a" },
  kpiRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 },
  kpiCard: {
    background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0",
    padding: 16, display: "flex", flexDirection: "column", gap: 2,
  },
  kpiLabel: { fontSize: 12, color: "#64748b", fontWeight: 500 },
  kpiValue: { fontSize: 22, fontWeight: 700, color: "#0f172a" },
  alertRow: { display: "flex", gap: 12, marginBottom: 16 },
  alertCard: {
    flex: 1, padding: "12px 16px", background: "#fff", borderRadius: 8,
    border: "1px solid #e2e8f0", borderLeftWidth: 4, display: "flex", alignItems: "center", gap: 8,
  },
  alertCount: { fontSize: 28, fontWeight: 700, color: "#0f172a" },
  alertLabel: { fontSize: 13, color: "#64748b" },
  section: { background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 16, marginBottom: 12 },
  sectionTitle: { margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "#0f172a" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { fontSize: 11, fontWeight: 600, color: "#64748b", padding: "8px 6px", borderBottom: "1px solid #e2e8f0", textAlign: "left" },
  tr: { borderBottom: "1px solid #f8fafc" },
  td: { fontSize: 13, color: "#0f172a", padding: "8px 6px" },
  list: { display: "flex", flexDirection: "column", gap: 4 },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "#fff",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    gap: 12,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  rowName: { fontSize: 14, fontWeight: 500, color: "#0f172a" },
  criticalTag: {
    fontSize: 10,
    fontWeight: 700,
    background: "#fef2f2",
    color: "#dc2626",
    padding: "1px 6px",
    borderRadius: 4,
  },
  lowTag: {
    fontSize: 10,
    fontWeight: 700,
    background: "#fef3c7",
    color: "#92400e",
    padding: "1px 6px",
    borderRadius: 4,
  },
  stockBar: {
    width: "100%",
    height: 4,
    background: "#f1f5f9",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
  },
  stockFill: { height: "100%", borderRadius: 2, transition: "width 0.3s" },
  stockText: { fontSize: 11, color: "#94a3b8" },
  adjBtn: {
    padding: "6px 14px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    color: "#334155",
    whiteSpace: "nowrap",
  },
  adjForm: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  adjInput: {
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    fontSize: 12,
    width: 100,
  },
  adjSelect: {
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    fontSize: 12,
  },
  adjSave: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  adjCancel: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    color: "#64748b",
  },
};
