import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { searchProducts, getCategories, toggleFavorite } from "@/services/api";
import type { Product, Category } from "@/types";
import toast from "react-hot-toast";

interface Props {
  onSelect: (product: Product) => void;
  /** When set (POS), products with volume promos get a picker to add 6, 12, ... at once */
  onSelectQty?: (product: Product, qty: number) => void;
  favoritesOnly?: boolean;
  products?: Product[];
  onProductsChange?: (products: Product[]) => void;
}

export default function ProductGrid({ onSelect, onSelectQty, favoritesOnly, products: externalProducts, onProductsChange }: Props) {
  const [internalProducts, setInternalProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [promoProduct, setPromoProduct] = useState<Product | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const products = externalProducts ?? internalProducts;
  const setProducts = onProductsChange ?? setInternalProducts;

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
    if (!externalProducts) loadProducts("");
  }, []);

  const loadProducts = useCallback((q: string) => {
    setLoading(true);
    searchProducts(q, 5000)
      .then((p) => setProducts(p))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setProducts]);

  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout(debounceRef.current);
    // If externalProducts provided, filter client-side (works offline too)
    if (externalProducts) return;
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

  const displayProducts = useMemo(() => {
    const base = externalProducts && search
      ? products.filter((p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.barcode?.toLowerCase().includes(search.toLowerCase())
        )
      : products;
    return favoritesOnly ? base.filter((p) => p.is_favorite) : base;
  }, [products, search, externalProducts, favoritesOnly]);

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

              {/* Col 4: Promo qty picker (only in POS, only with promos) */}
              {onSelectQty && (p.volume_promos?.length ?? 0) > 0 && (
                <button
                  style={S.promoBtn}
                  onClick={(e) => { e.stopPropagation(); setPromoProduct(p); }}
                >
                  6+
                </button>
              )}

              {/* Col 5: Price */}
              <span style={S.price}>${p.price.toFixed(2)}</span>

              {/* Col 6: Stock */}
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

      {/* Promo quantity picker */}
      {promoProduct && onSelectQty && (
        <div style={S.promoOverlay} onClick={() => setPromoProduct(null)}>
          <div style={S.promoPanel} onClick={(e) => e.stopPropagation()}>
            <h3 style={S.promoTitle}>{promoProduct.name}</h3>
            <button
              style={S.promoOption}
              onClick={() => { onSelectQty(promoProduct, 1); setPromoProduct(null); }}
            >
              <span>1 unidad</span>
              <span style={S.promoOptPrice}>${promoProduct.price.toFixed(2)}</span>
            </button>
            {[...(promoProduct.volume_promos ?? [])]
              .sort((a, b) => a.min_units - b.min_units)
              .map((vp) => (
                <button
                  key={vp.id}
                  style={S.promoOption}
                  onClick={() => { onSelectQty(promoProduct, vp.min_units); setPromoProduct(null); }}
                >
                  <span>{vp.min_units} unidades</span>
                  <span style={S.promoOptPrice}>
                    ${vp.promo_price.toFixed(2)}
                    <span style={S.promoOptUnit}> (${(vp.promo_price / vp.min_units).toFixed(2)} c/u)</span>
                  </span>
                </button>
              ))}
            <button style={S.promoCancel} onClick={() => setPromoProduct(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  promoBtn: {
    flexShrink: 0,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #2563eb",
    background: "#eff6ff",
    color: "#2563eb",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
  },
  promoOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    padding: 16,
  },
  promoPanel: {
    background: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 360,
    maxHeight: "80vh",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  promoTitle: { margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#0f172a", textAlign: "center" },
  promoOption: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 600,
    color: "#0f172a",
  },
  promoOptPrice: { fontWeight: 700, color: "#2563eb" },
  promoOptUnit: { fontSize: 11, fontWeight: 500, color: "#64748b" },
  promoCancel: {
    marginTop: 4,
    padding: "10px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 13,
  },
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
