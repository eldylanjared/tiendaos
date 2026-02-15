import { useState, useEffect, useRef } from "react";
import { searchProducts, getCategories } from "@/services/api";
import type { Product, Category } from "@/types";

interface Props {
  onSelect: (product: Product) => void;
}

export default function ProductGrid({ onSelect }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
    loadProducts("");
  }, []);

  function loadProducts(q: string) {
    setLoading(true);
    searchProducts(q, 60)
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadProducts(val), 250);
  }

  return (
    <div style={styles.container}>
      <div style={styles.searchRow}>
        <input
          ref={searchRef}
          style={styles.searchInput}
          placeholder="Buscar producto o código de barras..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          data-barcode="true"
        />
        {search && (
          <button style={styles.clearBtn} onClick={() => { setSearch(""); loadProducts(""); }}>
            ✕
          </button>
        )}
      </div>
      <div style={styles.grid}>
        {loading && products.length === 0 && <p style={styles.msg}>Cargando...</p>}
        {!loading && products.length === 0 && <p style={styles.msg}>No se encontraron productos</p>}
        {products.map((p) => {
          const cat = categories.find((c) => c.id === p.category_id);
          return (
            <button key={p.id} style={styles.card} onClick={() => onSelect(p)}>
              <div style={{ ...styles.catBadge, background: cat?.color || "#94a3b8" }}>
                {cat?.name || "General"}
              </div>
              <div style={styles.productName}>{p.name}</div>
              <div style={styles.priceRow}>
                <span style={styles.price}>${p.price.toFixed(2)}</span>
                <span style={{ ...styles.stock, color: p.stock <= p.min_stock ? "#dc2626" : "#16a34a" }}>
                  {p.stock} uds
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" },
  searchRow: { position: "relative", padding: "12px 12px 8px" },
  searchInput: {
    width: "100%",
    padding: "10px 36px 10px 14px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    background: "#f8fafc",
  },
  clearBtn: {
    position: "absolute",
    right: 20,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#94a3b8",
    fontSize: 14,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 8,
    padding: "0 12px 12px",
    overflowY: "auto",
    flex: 1,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.1s",
    minHeight: 80,
  },
  catBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: "#fff",
    padding: "2px 6px",
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  productName: { fontSize: 13, fontWeight: 500, color: "#1e293b", flex: 1, lineHeight: 1.3 },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  price: { fontSize: 15, fontWeight: 700, color: "#0f172a" },
  stock: { fontSize: 11, fontWeight: 500 },
  msg: { gridColumn: "1 / -1", textAlign: "center", color: "#94a3b8", padding: 40 },
};
