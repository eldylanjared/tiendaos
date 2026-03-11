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

// Inject CSS with !important to survive forced dark mode
let gridStyleInjected = false;
function injectGridStyles() {
  if (gridStyleInjected) return;
  gridStyleInjected = true;
  const s = document.createElement("style");
  s.textContent = `
    /* Opt entire card tree out of browser forced dark mode */
    .pg-card, .pg-card * {
      forced-color-adjust: none !important;
      -webkit-forced-color-adjust: none !important;
      color-scheme: light only !important;
    }
    .pg-card {
      position: relative;
      padding: 0;
      border-radius: 10px;
      border: 1px solid #e2e8f0 !important;
      background-color: #ffffff !important;
      color: #000000 !important;
      cursor: pointer;
      text-align: left;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .pg-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .pg-star {
      position: absolute; top: 4px; right: 4px;
      font-size: 18px; cursor: pointer; line-height: 1;
      padding: 2px 4px; z-index: 2; border-radius: 4px;
      color: #cbd5e1 !important;
      background-color: rgba(255,255,255,0.95) !important;
    }
    .pg-star.active { color: #f59e0b !important; }
    .pg-img-wrap {
      width: 100%; height: 90px;
      display: flex; align-items: center; justify-content: center;
      background-color: #f8fafc !important;
      overflow: hidden;
    }
    .pg-img { width: 100%; height: 100%; object-fit: contain; }
    .pg-img-ph {
      font-size: 28px; font-weight: 700;
      color: #94a3b8 !important;
    }
    .pg-info {
      display: flex; flex-direction: column;
      padding: 6px 8px 8px; gap: 3px; flex: 1;
      background-color: #ffffff !important;
    }
    .pg-cat {
      font-size: 9px; font-weight: 600;
      color: #ffffff !important;
      padding: 1px 5px; border-radius: 3px;
      align-self: flex-start;
    }
    .pg-name {
      font-size: 12px; font-weight: 600;
      color: #1e293b !important;
      line-height: 1.3;
      word-break: break-word;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      /* text shadow as fallback if color gets overridden */
      text-shadow: 0 0 0 #1e293b;
      -webkit-text-fill-color: #1e293b;
    }
    .pg-price-row {
      display: flex; justify-content: space-between;
      align-items: center; margin-top: auto;
    }
    .pg-price {
      font-size: 15px; font-weight: 700;
      color: #0f172a !important;
      -webkit-text-fill-color: #0f172a;
    }
    .pg-stock {
      font-size: 10px; font-weight: 600;
      padding: 1px 5px; border-radius: 4px;
      background-color: #f1f5f9 !important;
    }
    .pg-stock.low { color: #dc2626 !important; -webkit-text-fill-color: #dc2626; }
    .pg-stock.ok { color: #16a34a !important; -webkit-text-fill-color: #16a34a; }
    .pg-search {
      width: 100%; padding: 8px 32px 8px 12px;
      border-radius: 8px; border: 1px solid #e2e8f0 !important;
      font-size: 13px; outline: none; box-sizing: border-box;
      background-color: #ffffff !important;
      color: #000000 !important;
      -webkit-text-fill-color: #000000;
      forced-color-adjust: none !important;
      color-scheme: light only !important;
    }
    .pg-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 8px; padding: 0 10px 10px;
      overflow-y: auto; flex: 1;
    }
  `;
  document.head.appendChild(s);
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
    injectGridStyles();
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ position: "relative", padding: "8px 10px 6px" }}>
        <input
          className="pg-search"
          placeholder={favoritesOnly ? "Buscar en favoritos..." : "Buscar producto o codigo de barras..."}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          data-barcode="true"
        />
        {search && (
          <button
            style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13 }}
            onClick={() => { setSearch(""); loadProducts(""); }}
          >
            X
          </button>
        )}
      </div>
      <div className="pg-grid">
        {loading && displayProducts.length === 0 && <p style={{ gridColumn: "1 / -1", textAlign: "center", color: "#94a3b8", padding: 40, fontSize: 13 }}>Cargando...</p>}
        {!loading && displayProducts.length === 0 && (
          <p style={{ gridColumn: "1 / -1", textAlign: "center", color: "#94a3b8", padding: 40, fontSize: 13 }}>
            {favoritesOnly ? "No hay favoritos — usa la estrella en 'Todos' para agregar" : "No se encontraron productos"}
          </p>
        )}
        {displayProducts.map((p) => {
          const cat = categories.find((c) => c.id === p.category_id);
          return (
            <button key={p.id} className="pg-card" onClick={() => onSelect(p)}>
              <span
                className={`pg-star${p.is_favorite ? " active" : ""}`}
                onClick={(e) => handleToggleFavorite(e, p)}
                title={p.is_favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
              >
                {p.is_favorite ? "\u2605" : "\u2606"}
              </span>
              <div className="pg-img-wrap">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="pg-img" />
                ) : (
                  <div className="pg-img-ph">{p.name.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div className="pg-info">
                {cat && (
                  <div className="pg-cat" style={{ background: cat.color || "#94a3b8" }}>
                    {cat.name}
                  </div>
                )}
                <div className="pg-name">{p.name}</div>
                <div className="pg-price-row">
                  <span className="pg-price">${p.price.toFixed(2)}</span>
                  <span className={`pg-stock ${p.stock <= p.min_stock ? "low" : "ok"}`}>
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
