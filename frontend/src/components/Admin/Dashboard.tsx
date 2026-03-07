import { useState, useEffect } from "react";
import { getDashboard } from "@/services/api";
import type { DashboardData } from "@/types";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  async function loadDashboard() {
    try {
      const d = await getDashboard();
      setData(d);
    } catch { /* ignore */ }
    setLoading(false);
  }

  if (loading) return <p style={{ textAlign: "center", color: "#94a3b8", marginTop: 40 }}>Cargando...</p>;
  if (!data) return <p style={{ textAlign: "center", color: "#94a3b8", marginTop: 40 }}>Error al cargar dashboard</p>;

  const salesChange = data.yesterday_total > 0
    ? ((data.total_sales - data.yesterday_total) / data.yesterday_total * 100).toFixed(1)
    : null;

  const maxHourSales = Math.max(...data.sales_by_hour.map(h => h.sales), 1);

  return (
    <div>
      <div style={styles.kpiRow}>
        <KpiCard label="Ventas Hoy" value={`$${data.total_sales.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
          sub={salesChange ? `${Number(salesChange) >= 0 ? "+" : ""}${salesChange}% vs ayer` : "Sin datos de ayer"}
          subColor={salesChange && Number(salesChange) >= 0 ? "#16a34a" : "#dc2626"} />
        <KpiCard label="Transacciones" value={String(data.transaction_count)} />
        <KpiCard label="Ticket Promedio" value={`$${data.avg_ticket.toFixed(2)}`} />
        <KpiCard label="Ganancia Hoy" value={`$${data.total_profit.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
          subColor="#16a34a" />
      </div>

      <div style={styles.grid2}>
        {/* Sales by hour */}
        <div style={styles.card}>
          <h4 style={styles.cardTitle}>Ventas por Hora</h4>
          <div style={styles.chartContainer}>
            {data.sales_by_hour.map((h) => (
              <div key={h.hour} style={styles.barCol}>
                <div style={styles.barWrapper}>
                  <div style={{
                    ...styles.bar,
                    height: `${(h.sales / maxHourSales) * 100}%`,
                    background: h.sales > 0 ? "#2563eb" : "#e2e8f0",
                  }} />
                </div>
                <span style={styles.barLabel}>{h.hour}</span>
                {h.sales > 0 && <span style={styles.barValue}>${h.sales >= 1000 ? `${(h.sales / 1000).toFixed(1)}k` : h.sales.toFixed(0)}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Payment breakdown */}
        <div style={styles.card}>
          <h4 style={styles.cardTitle}>Metodo de Pago</h4>
          <div style={styles.paymentList}>
            <PaymentRow label="Efectivo" amount={data.payment_breakdown.cash} total={data.total_sales} color="#16a34a" />
            <PaymentRow label="Tarjeta" amount={data.payment_breakdown.card} total={data.total_sales} color="#2563eb" />
            <PaymentRow label="Mixto" amount={data.payment_breakdown.mixed} total={data.total_sales} color="#f59e0b" />
          </div>
        </div>
      </div>

      {/* Top products */}
      <div style={styles.card}>
        <h4 style={styles.cardTitle}>Top 10 Productos Hoy</h4>
        {data.top_products.length === 0 && <p style={{ color: "#94a3b8", fontSize: 13 }}>Sin ventas hoy</p>}
        <div style={styles.topList}>
          {data.top_products.map((p, i) => (
            <div key={p.product_name} style={styles.topRow}>
              <span style={styles.topRank}>#{i + 1}</span>
              <span style={styles.topName}>{p.product_name}</span>
              <span style={styles.topQty}>{p.quantity_sold} uds</span>
              <span style={styles.topRev}>${p.revenue.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div style={styles.kpiCard}>
      <span style={styles.kpiLabel}>{label}</span>
      <span style={styles.kpiValue}>{value}</span>
      {sub && <span style={{ ...styles.kpiSub, color: subColor || "#64748b" }}>{sub}</span>}
    </div>
  );
}

function PaymentRow({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? (amount / total * 100) : 0;
  return (
    <div style={styles.payRow}>
      <div style={styles.payInfo}>
        <span style={{ ...styles.payDot, background: color }} />
        <span style={styles.payLabel}>{label}</span>
      </div>
      <div style={styles.payRight}>
        <span style={styles.payAmount}>${amount.toFixed(2)}</span>
        <span style={styles.payPct}>{pct.toFixed(0)}%</span>
      </div>
      <div style={styles.payBarBg}>
        <div style={{ ...styles.payBarFill, width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  kpiRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 },
  kpiCard: {
    background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0",
    padding: 16, display: "flex", flexDirection: "column", gap: 2,
  },
  kpiLabel: { fontSize: 12, color: "#64748b", fontWeight: 500 },
  kpiValue: { fontSize: 24, fontWeight: 700, color: "#0f172a" },
  kpiSub: { fontSize: 11, fontWeight: 500 },
  grid2: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 },
  card: {
    background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 16,
    marginBottom: 12,
  },
  cardTitle: { margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "#0f172a" },
  chartContainer: { display: "flex", gap: 2, alignItems: "flex-end", height: 140 },
  barCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  barWrapper: { width: "100%", height: 100, display: "flex", alignItems: "flex-end" },
  bar: { width: "100%", borderRadius: "2px 2px 0 0", minHeight: 2, transition: "height 0.3s" },
  barLabel: { fontSize: 9, color: "#94a3b8" },
  barValue: { fontSize: 8, color: "#64748b", whiteSpace: "nowrap" },
  paymentList: { display: "flex", flexDirection: "column", gap: 12 },
  payRow: { display: "flex", flexDirection: "column", gap: 4 },
  payInfo: { display: "flex", alignItems: "center", gap: 6 },
  payDot: { width: 8, height: 8, borderRadius: "50%" },
  payLabel: { fontSize: 13, color: "#334155", fontWeight: 500 },
  payRight: { display: "flex", justifyContent: "space-between" },
  payAmount: { fontSize: 14, fontWeight: 600, color: "#0f172a" },
  payPct: { fontSize: 12, color: "#64748b" },
  payBarBg: { height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" },
  payBarFill: { height: "100%", borderRadius: 2, transition: "width 0.3s" },
  topList: { display: "flex", flexDirection: "column", gap: 4 },
  topRow: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "6px 0", borderBottom: "1px solid #f8fafc",
  },
  topRank: { fontSize: 12, fontWeight: 700, color: "#94a3b8", width: 28 },
  topName: { fontSize: 13, color: "#0f172a", flex: 1 },
  topQty: { fontSize: 12, color: "#64748b" },
  topRev: { fontSize: 13, fontWeight: 600, color: "#0f172a", width: 80, textAlign: "right" },
};
