import { useState, useEffect, useRef } from "react";
import { searchProducts, getCategories, toggleFavorite } from "@/services/api";
import type { Product, Category } from "@/types";
import toast from "react-hot-toast";

interface Props {
  onSelect: (product: Product) => void;
  favoritesOnly?: boolean;
}

export default function ProductGrid({ onSelect, favoritesOnly }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
    loadProducts("");
  }, []);

  function loadProducts(q: string) {
    setLoading(true);
    searchProducts(q, 100)
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadProducts(val), 250);
  }

  async function handleToggleFavorite(e: React.MouseEvent, product: Product) {
    e.stopPropagation();
    try {
      const result = await toggleFavorite(product.id);
      setProducts((prev) =>
        prev.map((p) => p.id === product.id ? { ...p, is_favorite: result.is_favorite } : p)
      );
      toast.success(result.is_favorite ? `${product.name} agregado a favoritos` : `${product.name} quitado de favoritos`);
    } catch {
      toast.error("Error al cambiar favorito");
    }
  }

  const displayProducts = favoritesOnly
    ? products.filter((p) => p.is_favorite)
    : products;

  return (
    <div style={styles.container}>
      <div style={styles.searchRow}>
        <input
          style={styles.searchInput}
          placeholder={favoritesOnly ? "Buscar en favoritos..." : "Buscar producto o codigo de barras..."}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          data-barcode="true"
        />
        {search && (
          <button style={styles.clearBtn} onClick={() => { setSearch(""); loadProducts(""); }}>
            X
          </button>
        )}
      </div>
      <div style={styles.grid}>
        {loading && displayProducts.length === 0 && <p style={styles.msg}>Cargando...</p>}
        {!loading && displayProducts.length === 0 && (
          <p style={styles.msg}>
            {favoritesOnly ? "No hay favoritos — agrega productos con la estrella" : "No se encontraron productos"}
          </p>
        )}
        {displayProducts.map((p) => {
          const cat = categories.find((c) => c.id === p.category_id);
          return (
            <button key={p.id} style={styles.card} onClick={() => onSelect(p)}>
              <div style={styles.cardInner}>
                <div style={styles.imgWrap}>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} style={styles.img} />
                  ) : (
                    <div style={styles.imgPlaceholder}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={styles.cardInfo}>
                  <div style={styles.cardTopRow}>
                    <div style={{ ...styles.catBadge, background: cat?.color || "#94a3b8" }}>
                      {cat?.name || "General"}
                    </div>
                    <span
                      style={p.is_favorite ? styles.starActive : styles.star}
                      onClick={(e) => handleToggleFavorite(e, p)}
                      title={p.is_favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                    >
                      {p.is_favorite ? "\u2605" : "\u2606"}
                    </span>
                  </div>
                  <div style={styles.productName}>{p.name}</div>
                  <div style={styles.priceRow}>
                    <span style={styles.price}>${p.price.toFixed(2)}</span>
                    <span style={{ ...styles.stock, color: p.stock <= p.min_stock ? "#dc2626" : "#16a34a" }}>
                      {p.stock} uds
                    </span>
                  </div>
                </div>
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
    padding: 0,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.1s",
    overflow: "hidden",
  },
  cardInner: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 80,
  },
  imgWrap: {
    width: 70,
    minHeight: 70,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
  },
  img: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  imgPlaceholder: {
    fontSize: 22,
    fontWeight: 700,
    color: "#94a3b8",
  },
  cardInfo: {
    display: "flex",
    flexDirection: "column" as const,
    padding: "8px 10px",
    flex: 1,
    minWidth: 0,
  },
  cardTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  catBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: "#fff",
    padding: "2px 6px",
    borderRadius: 4,
  },
  star: {
    fontSize: 16,
    cursor: "pointer",
    color: "#cbd5e1",
    lineHeight: 1,
    padding: "2px",
  },
  starActive: {
    fontSize: 16,
    cursor: "pointer",
    color: "#f59e0b",
    lineHeight: 1,
    padding: "2px",
  },
  productName: { fontSize: 12, fontWeight: 500, color: "#1e293b", flex: 1, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis" as const },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  price: { fontSize: 15, fontWeight: 700, color: "#0f172a" },
  stock: { fontSize: 11, fontWeight: 500 },
  msg: { gridColumn: "1 / -1", textAlign: "center", color: "#94a3b8", padding: 40 },
};
