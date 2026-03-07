import { useState, useEffect } from "react";
import {
  getSalesSummary, getProductProfitability,
  getCategoryPerformance, getCashierPerformance, exportSalesCsv,
} from "@/services/api";
import type { SalesPeriod, ProductProfit, CategoryPerf, CashierPerf } from "@/types";
import toast from "react-hot-toast";

type ReportTab = "sales" | "products" | "categories" | "cashiers";

const reportTabs: { key: ReportTab; label: string }[] = [
  { key: "sales", label: "Ventas" },
  { key: "products", label: "Productos" },
  { key: "categories", label: "Categorias" },
  { key: "cashiers", label: "Cajeros" },
];

export default function Reports() {
  const [tab, setTab] = useState<ReportTab>("sales");
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const [start, setStart] = useState(thirtyDaysAgo);
  const [end, setEnd] = useState(today);
  const [groupBy, setGroupBy] = useState("day");

  return (
    <div>
      <div style={styles.toolbar}>
        <div style={styles.tabs}>
          {reportTabs.map((t) => (
            <button
              key={t.key}
              style={tab === t.key ? { ...styles.tabBtn, ...styles.tabBtnActive } : styles.tabBtn}
              onClick={() => setTab(t.key)}
            >{t.label}</button>
          ))}
        </div>
        <div style={styles.filters}>
          <input type="date" style={styles.dateInput} value={start} onChange={(e) => setStart(e.target.value)} />
          <span style={{ color: "#94a3b8" }}>a</span>
          <input type="date" style={styles.dateInput} value={end} onChange={(e) => setEnd(e.target.value)} />
          {tab === "sales" && (
            <select style={styles.select} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              <option value="day">Diario</option>
              <option value="week">Semanal</option>
              <option value="month">Mensual</option>
            </select>
          )}
          <button style={styles.exportBtn} onClick={async () => {
            try {
              const blob = await exportSalesCsv(start, end);
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `ventas_${start}_${end}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("CSV descargado");
            } catch { toast.error("Error al exportar"); }
          }}>Exportar CSV</button>
        </div>
      </div>

      {tab === "sales" && <SalesReport start={start} end={end} groupBy={groupBy} />}
      {tab === "products" && <ProductReport start={start} end={end} />}
      {tab === "categories" && <CategoryReport start={start} end={end} />}
      {tab === "cashiers" && <CashierReport start={start} end={end} />}
    </div>
  );
}

function SalesReport({ start, end, groupBy }: { start: string; end: string; groupBy: string }) {
  const [data, setData] = useState<SalesPeriod[]>([]);
  useEffect(() => { getSalesSummary(start, end, groupBy).then(setData).catch(() => {}); }, [start, end, groupBy]);

  const maxSales = Math.max(...data.map(d => d.total_sales), 1);

  return (
    <div style={styles.reportCard}>
      <div style={styles.summaryRow}>
        <SumCard label="Total Ventas" value={`$${data.reduce((s, d) => s + d.total_sales, 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} />
        <SumCard label="Transacciones" value={String(data.reduce((s, d) => s + d.transactions, 0))} />
        <SumCard label="Ticket Promedio" value={`$${data.length > 0 ? (data.reduce((s, d) => s + d.total_sales, 0) / data.reduce((s, d) => s + d.transactions, 0) || 0).toFixed(2) : "0.00"}`} />
      </div>
      <div style={styles.chartArea}>
        {data.map((d) => (
          <div key={d.period} style={styles.hBarRow}>
            <span style={styles.hBarLabel}>{d.period}</span>
            <div style={styles.hBarTrack}>
              <div style={{ ...styles.hBarFill, width: `${(d.total_sales / maxSales) * 100}%` }} />
            </div>
            <span style={styles.hBarValue}>${d.total_sales.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            <span style={styles.hBarSub}>{d.transactions} txn</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductReport({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<ProductProfit[]>([]);
  useEffect(() => { getProductProfitability(start, end, 100).then(setData).catch(() => {}); }, [start, end]);

  return (
    <div style={styles.reportCard}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Producto</th>
            <th style={{ ...styles.th, textAlign: "right" }}>Uds</th>
            <th style={{ ...styles.th, textAlign: "right" }}>Ingreso</th>
            <th style={{ ...styles.th, textAlign: "right" }}>Costo</th>
            <th style={{ ...styles.th, textAlign: "right" }}>Ganancia</th>
            <th style={{ ...styles.th, textAlign: "right" }}>Margen</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.product_id} style={styles.tr}>
              <td style={styles.td}>{p.product_name}</td>
              <td style={{ ...styles.td, textAlign: "right" }}>{p.units_sold}</td>
              <td style={{ ...styles.td, textAlign: "right" }}>${p.revenue.toFixed(2)}</td>
              <td style={{ ...styles.td, textAlign: "right" }}>${p.cost.toFixed(2)}</td>
              <td style={{ ...styles.td, textAlign: "right", color: p.profit >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                ${p.profit.toFixed(2)}
              </td>
              <td style={{ ...styles.td, textAlign: "right" }}>
                <span style={{
                  ...styles.marginBadge,
                  background: p.margin_pct >= 30 ? "#dcfce7" : p.margin_pct >= 15 ? "#fef9c3" : "#fef2f2",
                  color: p.margin_pct >= 30 ? "#16a34a" : p.margin_pct >= 15 ? "#a16207" : "#dc2626",
                }}>{p.margin_pct}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && <p style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>Sin datos para este periodo</p>}
    </div>
  );
}

function CategoryReport({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<CategoryPerf[]>([]);
  useEffect(() => { getCategoryPerformance(start, end).then(setData).catch(() => {}); }, [start, end]);

  const maxRev = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div style={styles.reportCard}>
      {data.map((c) => (
        <div key={c.category} style={styles.catRow}>
          <div style={styles.catInfo}>
            <span style={styles.catName}>{c.category}</span>
            <span style={styles.catSub}>{c.products_count} productos, {c.units_sold} uds vendidas</span>
          </div>
          <div style={styles.catBarTrack}>
            <div style={{ ...styles.catBarFill, width: `${(c.revenue / maxRev) * 100}%` }} />
          </div>
          <span style={styles.catRevenue}>${c.revenue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
        </div>
      ))}
      {data.length === 0 && <p style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>Sin datos para este periodo</p>}
    </div>
  );
}

function CashierReport({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<CashierPerf[]>([]);
  useEffect(() => { getCashierPerformance(start, end).then(setData).catch(() => {}); }, [start, end]);

  return (
    <div style={styles.reportCard}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Cajero</th>
            <th style={{ ...styles.th, textAlign: "right" }}>Ventas</th>
            <th style={{ ...styles.th, textAlign: "right" }}>Transacciones</th>
            <th style={{ ...styles.th, textAlign: "right" }}>Ticket Prom.</th>
            <th style={{ ...styles.th, textAlign: "right" }}>Articulos</th>
            <th style={{ ...styles.th, textAlign: "right" }}>Anuladas</th>
          </tr>
        </thead>
        <tbody>
          {data.map((c) => (
            <tr key={c.user_id} style={styles.tr}>
              <td style={{ ...styles.td, fontWeight: 600 }}>{c.full_name}</td>
              <td style={{ ...styles.td, textAlign: "right" }}>${c.total_sales.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
              <td style={{ ...styles.td, textAlign: "right" }}>{c.transactions}</td>
              <td style={{ ...styles.td, textAlign: "right" }}>${c.avg_ticket.toFixed(2)}</td>
              <td style={{ ...styles.td, textAlign: "right" }}>{c.items_sold}</td>
              <td style={{ ...styles.td, textAlign: "right", color: c.voided > 0 ? "#dc2626" : "#64748b" }}>{c.voided}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && <p style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>Sin datos para este periodo</p>}
    </div>
  );
}

function SumCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.sumCard}>
      <span style={styles.sumLabel}>{label}</span>
      <span style={styles.sumValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  tabs: { display: "flex", gap: 4 },
  tabBtn: {
    padding: "6px 14px", borderRadius: 6, border: "1px solid #e2e8f0",
    background: "#fff", color: "#64748b", cursor: "pointer", fontSize: 12, fontWeight: 500,
  },
  tabBtnActive: { background: "#0f172a", color: "#fff", borderColor: "#0f172a" },
  filters: { display: "flex", alignItems: "center", gap: 8 },
  dateInput: { padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12 },
  select: { padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12 },
  exportBtn: {
    padding: "6px 14px", borderRadius: 6, border: "1px solid #2563eb",
    background: "#2563eb", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600,
  },
  reportCard: {
    background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 16, overflow: "auto",
  },
  summaryRow: { display: "flex", gap: 12, marginBottom: 16 },
  sumCard: { flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "12px 16px", background: "#f8fafc", borderRadius: 8 },
  sumLabel: { fontSize: 11, color: "#64748b", fontWeight: 500 },
  sumValue: { fontSize: 20, fontWeight: 700, color: "#0f172a" },
  chartArea: { display: "flex", flexDirection: "column", gap: 4 },
  hBarRow: { display: "flex", alignItems: "center", gap: 8 },
  hBarLabel: { fontSize: 11, color: "#64748b", width: 80, flexShrink: 0, textAlign: "right" },
  hBarTrack: { flex: 1, height: 16, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" },
  hBarFill: { height: "100%", background: "#2563eb", borderRadius: 4, transition: "width 0.3s" },
  hBarValue: { fontSize: 12, fontWeight: 600, color: "#0f172a", width: 90, textAlign: "right" },
  hBarSub: { fontSize: 10, color: "#94a3b8", width: 50 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { fontSize: 11, fontWeight: 600, color: "#64748b", padding: "8px 6px", borderBottom: "1px solid #e2e8f0", textAlign: "left" },
  tr: { borderBottom: "1px solid #f8fafc" },
  td: { fontSize: 13, color: "#0f172a", padding: "8px 6px" },
  marginBadge: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4 },
  catRow: { display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f8fafc" },
  catInfo: { width: 180, flexShrink: 0, display: "flex", flexDirection: "column" },
  catName: { fontSize: 13, fontWeight: 600, color: "#0f172a" },
  catSub: { fontSize: 10, color: "#94a3b8" },
  catBarTrack: { flex: 1, height: 12, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" },
  catBarFill: { height: "100%", background: "#8b5cf6", borderRadius: 4, transition: "width 0.3s" },
  catRevenue: { fontSize: 13, fontWeight: 600, color: "#0f172a", width: 100, textAlign: "right" },
};
