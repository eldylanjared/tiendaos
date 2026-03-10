import { useState, useEffect, useRef, useCallback } from "react";
import { searchProducts, getCategories, toggleFavorite } from "@/services/api";
import type { Product, Category } from "@/types";
import toast from "react-hot-toast";

interface Props {
  onSelect: (product: Product) => void;
  favoritesOnly?: boolean;
  /** Shared products state — when provided, this component won't fetch its own */
  products?: Product[];
  onProductsChange?: (products: Product[]) => void;
}

export default function ProductGrid({ onSelect, favoritesOnly, products: externalProducts, onProductsChange }: Props) {
  const [internalProducts, setInternalProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const products = externalProducts ?? internalProducts;
  const setProducts = onProductsChange ?? setInternalProducts;

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
    if (!externalProducts) loadProducts("");
  }, []);

  const loadProducts = useCallback((q: string) => {
    setLoading(true);
    searchProducts(q, 100)
      .then((p) => setProducts(p))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setProducts]);

  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadProducts(val), 250);
  }

  async function handleToggleFavorite(e: React.MouseEvent, product: Product) {
    e.stopPropagation();
    try {
      const result = await toggleFavorite(product.id);
      setProducts(
        products.map((p) => p.id === product.id ? { ...p, is_favorite: result.is_favorite } : p)
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
            {favoritesOnly ? "No hay favoritos — usa la estrella en 'Todos' para agregar" : "No se encontraron productos"}
          </p>
        )}
        {displayProducts.map((p) => {
          const cat = categories.find((c) => c.id === p.category_id);
          return (
            <button key={p.id} style={styles.card} onClick={() => onSelect(p)}>
              {/* Star */}
              <span
                style={p.is_favorite ? styles.starActive : styles.star}
                onClick={(e) => handleToggleFavorite(e, p)}
                title={p.is_favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
              >
                {p.is_favorite ? "\u2605" : "\u2606"}
              </span>
              {/* Image */}
              <div style={styles.imgWrap}>
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} style={styles.img} />
                ) : (
                  <div style={styles.imgPlaceholder}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {/* Info */}
              <div style={styles.cardInfo}>
                {cat && (
                  <div style={{ ...styles.catBadge, background: cat.color || "#94a3b8" }}>
                    {cat.name}
                  </div>
                )}
                <div style={styles.productName}>{p.name}</div>
                <div style={styles.priceRow}>
                  <span style={styles.price}>${p.price.toFixed(2)}</span>
                  <span style={{ ...styles.stock, color: p.stock <= p.min_stock ? "#dc2626" : "#16a34a" }}>
                    {p.stock}
                  </span>
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
  searchRow: { position: "relative", padding: "8px 10px 6px" },
  searchInput: {
    width: "100%",
    padding: "8px 32px 8px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    background: "#fff",
  },
  clearBtn: {
    position: "absolute",
    right: 18,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#94a3b8",
    fontSize: 13,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: 8,
    padding: "0 10px 10px",
    overflowY: "auto",
    flex: 1,
  },
  card: {
    position: "relative",
    padding: 0,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    textAlign: "left",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  star: {
    position: "absolute",
    top: 4,
    right: 4,
    fontSize: 18,
    cursor: "pointer",
    color: "#cbd5e1",
    lineHeight: 1,
    padding: "2px 4px",
    zIndex: 2,
    background: "rgba(255,255,255,0.8)",
    borderRadius: 4,
  },
  starActive: {
    position: "absolute",
    top: 4,
    right: 4,
    fontSize: 18,
    cursor: "pointer",
    color: "#f59e0b",
    lineHeight: 1,
    padding: "2px 4px",
    zIndex: 2,
    background: "rgba(255,255,255,0.8)",
    borderRadius: 4,
  },
  imgWrap: {
    width: "100%",
    height: 90,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8fafc",
    overflow: "hidden",
  },
  img: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  imgPlaceholder: {
    fontSize: 28,
    fontWeight: 700,
    color: "#cbd5e1",
  },
  cardInfo: {
    display: "flex",
    flexDirection: "column" as const,
    padding: "6px 8px 8px",
    gap: 3,
    flex: 1,
  },
  catBadge: {
    fontSize: 9,
    fontWeight: 600,
    color: "#fff",
    padding: "1px 5px",
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  productName: {
    fontSize: 12,
    fontWeight: 600,
    color: "#1e293b",
    lineHeight: 1.3,
    wordBreak: "break-word" as const,
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
  },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" },
  price: { fontSize: 15, fontWeight: 700, color: "#0f172a" },
  stock: { fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: "#f1f5f9" },
  msg: { gridColumn: "1 / -1", textAlign: "center", color: "#94a3b8", padding: 40, fontSize: 13 },
};
