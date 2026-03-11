import { useState, useEffect, useRef, useCallback } from "react";
import { searchProducts, getCategories, toggleFavorite } from "@/services/api";
import type { Product, Category } from "@/types";
import toast from "react-hot-toast";

interface Props {
  onSelect: (product: Product) => void;
  favoritesOnly?: boolean;
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
    <div style={S.container}>
      {/* Search */}
      <div style={S.searchRow}>
        <input
          style={S.searchInput}
          placeholder={favoritesOnly ? "Buscar en favoritos..." : "Buscar producto o codigo de barras..."}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          data-barcode="true"
        />
        {search && (
          <button style={S.clearBtn} onClick={() => { setSearch(""); loadProducts(""); }}>X</button>
        )}
      </div>

      {/* Product list */}
      <div style={S.list}>
        {loading && displayProducts.length === 0 && (
          <p style={S.msg}>Cargando...</p>
        )}
        {!loading && displayProducts.length === 0 && (
          <p style={S.msg}>
            {favoritesOnly ? "No hay favoritos — usa la estrella en 'Todos' para agregar" : "No se encontraron productos"}
          </p>
        )}
        {displayProducts.map((p) => {
          const cat = categories.find((c) => c.id === p.category_id);
          return (
            <div key={p.id} style={S.row} onClick={() => onSelect(p)}>
              {/* Col 1: Star */}
              <span
                style={p.is_favorite ? S.starActive : S.star}
                onClick={(e) => handleToggleFavorite(e, p)}
              >
                {p.is_favorite ? "\u2605" : "\u2606"}
              </span>

              {/* Col 2: Image */}
              <div style={S.imgCol}>
                {p.image_url ? (
                  <img src={p.image_url} alt="" style={S.img} />
                ) : (
                  <div style={S.imgPh}>{p.name.charAt(0)}</div>
                )}
              </div>

              {/* Col 3: Name + Category (flexible) */}
              <div style={S.nameCol}>
                <span style={S.name}>{p.name}</span>
                {cat && (
                  <span style={{ ...S.catBadge, backgroundColor: cat.color || "#94a3b8" }}>
                    {cat.name}
                  </span>
                )}
              </div>

              {/* Col 4: Price */}
              <span style={S.price}>${p.price.toFixed(2)}</span>

              {/* Col 5: Stock */}
              <span style={{
                ...S.stock,
                color: p.stock <= p.min_stock ? "#ef4444" : "#22c55e",
              }}>
                {p.stock}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  searchRow: {
    position: "relative",
    padding: "8px 10px 6px",
    flexShrink: 0,
  },
  searchInput: {
    width: "100%",
    padding: "8px 32px 8px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box" as const,
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
  list: {
    flex: 1,
    overflowY: "auto",
    padding: "0 6px 10px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 8px",
    borderBottom: "1px solid #f1f5f9",
    cursor: "pointer",
    borderRadius: 6,
  },
  // Star
  star: {
    fontSize: 16,
    cursor: "pointer",
    color: "#cbd5e1",
    flexShrink: 0,
    width: 20,
    textAlign: "center",
  },
  starActive: {
    fontSize: 16,
    cursor: "pointer",
    color: "#f59e0b",
    flexShrink: 0,
    width: 20,
    textAlign: "center",
  },
  // Image column
  imgCol: {
    width: 36,
    height: 36,
    borderRadius: 6,
    overflow: "hidden",
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
  imgPh: {
    fontSize: 14,
    fontWeight: 700,
    color: "#94a3b8",
  },
  // Name column (takes remaining space)
  nameCol: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  catBadge: {
    fontSize: 9,
    fontWeight: 600,
    color: "#fff",
    padding: "1px 5px",
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  // Price column
  price: {
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
    textAlign: "right",
    minWidth: 60,
  },
  // Stock column
  stock: {
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
    textAlign: "right",
    minWidth: 30,
  },
  msg: {
    textAlign: "center",
    color: "#94a3b8",
    padding: 40,
    fontSize: 13,
  },
};
