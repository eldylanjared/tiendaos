import { useState, useEffect } from "react";
import { searchProducts } from "@/services/api";
import ProductForm from "@/components/Admin/ProductForm";
import type { Product } from "@/types";

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [search]);

  async function loadProducts() {
    try {
      const results = await searchProducts(search, 100);
      setProducts(results);
    } catch { /* ignore */ }
  }

  function handleSaved() {
    setSelected(null);
    setShowCreate(false);
    loadProducts();
  }

  if (showCreate) {
    return <ProductForm onSave={handleSaved} onCancel={() => setShowCreate(false)} />;
  }

  if (selected) {
    return <ProductForm product={selected} onSave={handleSaved} onCancel={() => setSelected(null)} />;
  }

  return (
    <div>
      <div style={styles.toolbar}>
        <input
          style={styles.search}
          placeholder="Buscar productos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button style={styles.addBtn} onClick={() => setShowCreate(true)}>
          + Nuevo Producto
        </button>
      </div>

      <div style={styles.list}>
        {products.map((p) => (
          <div key={p.id} style={styles.row} onClick={() => setSelected(p)}>
            <div style={styles.rowMain}>
              <span style={styles.rowName}>{p.name}</span>
              <span style={styles.rowBarcode}>{p.barcode}</span>
            </div>
            <div style={styles.rowMeta}>
              {p.sell_by_weight && <span style={styles.weightTag}>Peso</span>}
              {p.barcodes.length > 0 && <span style={styles.packTag}>{p.barcodes.length} pack(s)</span>}
              <span style={styles.rowPrice}>${p.price.toFixed(2)}</span>
              <span style={p.stock <= p.min_stock ? styles.stockLow : styles.stockOk}>
                {p.stock} uds
              </span>
            </div>
          </div>
        ))}
        {products.length === 0 && <p style={styles.empty}>No se encontraron productos</p>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: "flex", gap: 8, marginBottom: 12 },
  search: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    outline: "none",
  },
  addBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  list: { display: "flex", flexDirection: "column", gap: 4 },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    border: "1px solid #e2e8f0",
  },
  rowMain: { display: "flex", flexDirection: "column", gap: 2 },
  rowName: { fontSize: 14, fontWeight: 500, color: "#0f172a" },
  rowBarcode: { fontSize: 11, color: "#94a3b8" },
  rowMeta: { display: "flex", alignItems: "center", gap: 8 },
  rowPrice: { fontSize: 14, fontWeight: 600, color: "#0f172a" },
  stockOk: { fontSize: 12, color: "#16a34a", fontWeight: 500 },
  stockLow: { fontSize: 12, color: "#dc2626", fontWeight: 500 },
  weightTag: {
    fontSize: 10,
    fontWeight: 700,
    background: "#fef3c7",
    color: "#92400e",
    padding: "1px 6px",
    borderRadius: 4,
  },
  packTag: {
    fontSize: 10,
    fontWeight: 700,
    background: "#dbeafe",
    color: "#1e40af",
    padding: "1px 6px",
    borderRadius: 4,
  },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
};
