import { useState, useEffect } from "react";
import { searchProducts, adjustStock } from "@/services/api";
import type { Product } from "@/types";
import toast from "react-hot-toast";

export default function InventoryManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjQty, setAdjQty] = useState(0);
  const [adjReason, setAdjReason] = useState("restock");
  const [adjNotes, setAdjNotes] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      // Get all products including inactive, sort by stock urgency
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
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <h3 style={styles.title}>Inventario</h3>

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
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#0f172a" },
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
