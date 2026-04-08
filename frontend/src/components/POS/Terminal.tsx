import { useState, useCallback, useEffect } from "react";
import ProductGrid from "@/components/Products/ProductGrid";
import Cart from "@/components/POS/Cart";
import PaymentModal from "@/components/POS/PaymentModal";
import Receipt from "@/components/POS/Receipt";
import WeightInputModal from "@/components/POS/WeightInputModal";
import PriceInputModal from "@/components/POS/PriceInputModal";
import { useCart } from "@/hooks/useCart";
import { useBarcode } from "@/hooks/useBarcode";
import { useOfflineMode } from "@/hooks/useOfflineMode";
import { getByBarcode, searchProducts } from "@/services/api";
import type { Product, Sale, BarcodeLookupResult } from "@/types";
import toast from "react-hot-toast";

// Inject responsive CSS for terminal layout
let termStyleInjected = false;
function injectTerminalStyles() {
  if (termStyleInjected) return;
  termStyleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .tos-terminal {
      display: flex;
      flex: 1;
      overflow: auto;
    }
    .tos-terminal-products {
      flex: 1;
      overflow: hidden;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      min-width: 320px;
    }
    .tos-terminal-cart {
      flex: 1;
      flex-shrink: 0;
      max-width: 50%;
      min-width: 280px;
    }
    @media (max-width: 700px) {
      .tos-terminal {
        flex-direction: column;
      }
      .tos-terminal-products {
        flex: 1;
        min-width: 0;
        min-height: 40vh;
      }
      .tos-terminal-cart {
        max-width: 100%;
        min-width: 0;
        flex: 1;
        min-height: 0;
        border-top: 1px solid #e2e8f0;
      }
    }
  `;
  document.head.appendChild(style);
}

interface Props {
  storeName: string;
}

export default function Terminal({ storeName }: Props) {
  const cart = useCart();
  const { isOnline, cacheProducts, getCachedProducts } = useOfflineMode();
  const [showPayment, setShowPayment] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [weightProduct, setWeightProduct] = useState<Product | null>(null);
  const [variosProduct, setVariosProduct] = useState<Product | null>(null);
  const [showAllProducts, setShowAllProducts] = useState(false);

  // Shared products state so starring in "Todos" updates "Favoritos" instantly
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => { injectTerminalStyles(); }, []);

  useEffect(() => {
    // Show cache instantly, then refresh in background
    const cached = getCachedProducts();
    if (cached.length) setProducts(cached);

    searchProducts("", 5000)
      .then((p) => { setProducts(p); cacheProducts(p); })
      .catch(() => {
        if (!cached.length) return;
        toast("Modo sin conexión — usando productos guardados", { icon: "📶" });
      });
  }, []);

  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      try {
        const result: BarcodeLookupResult = await getByBarcode(barcode);
        const { product, pack } = result;

        if (product.sell_by_weight) {
          setWeightProduct(product);
          return;
        }

        if (product.name.toLowerCase().trim() === "varios") {
          setVariosProduct(product);
          return;
        }

        if (pack) {
          cart.addProduct(product, 1, pack.units, pack.pack_price);
          toast.success(`${product.name} x${pack.units} agregado`);
        } else {
          cart.addProduct(product);
          toast.success(`${product.name} agregado`);
        }
      } catch {
        toast.error(`Producto no encontrado: ${barcode}`);
      }
    },
    [cart]
  );

  useBarcode(handleBarcodeScan);

  function isVarios(product: Product) {
    return product.name.toLowerCase().trim() === "varios";
  }

  function handleSelectProduct(product: Product) {
    if (product.sell_by_weight) {
      setWeightProduct(product);
      return;
    }
    if (isVarios(product)) {
      setVariosProduct(product);
      return;
    }
    cart.addProduct(product);
  }

  function handleVariosConfirm(price: number) {
    if (variosProduct) {
      cart.addProduct(variosProduct, 1, 1, price);
      toast.success(`Varios $${price.toFixed(2)} agregado`);
      setVariosProduct(null);
    }
  }

  function handleWeightConfirm(weight: number) {
    if (weightProduct) {
      cart.addProduct(weightProduct, weight, 1, weightProduct.price);
      toast.success(`${weightProduct.name} ${weight.toFixed(3)} kg agregado`);
      setWeightProduct(null);
    }
  }

  function handleSaleComplete(sale: Sale) {
    setShowPayment(false);
    setCompletedSale(sale);
    cart.clearCart();
  }

  function handleNewSale() {
    setCompletedSale(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
    {!isOnline && (
      <div style={styles.offlineBanner}>
        📶 Sin conexión — modo local activo
      </div>
    )}
    <div className="tos-terminal">
      <div className="tos-terminal-products">
        <div style={styles.panelHeader}>
          <button
            style={!showAllProducts ? { ...styles.viewBtn, ...styles.viewBtnActive } : styles.viewBtn}
            onClick={() => setShowAllProducts(false)}
          >
            Favoritos
          </button>
          <button
            style={showAllProducts ? { ...styles.viewBtn, ...styles.viewBtnActive } : styles.viewBtn}
            onClick={() => setShowAllProducts(true)}
          >
            Todos
          </button>
        </div>
        <ProductGrid
          onSelect={handleSelectProduct}
          favoritesOnly={!showAllProducts}
          products={products}
          onProductsChange={setProducts}
        />
      </div>
      <div className="tos-terminal-cart">
        <Cart
          items={cart.items}
          subtotal={cart.subtotal}
          tax={cart.tax}
          total={cart.total}
          onUpdateQty={cart.updateQuantity}
          onRemove={cart.removeItem}
          onClear={cart.clearCart}
          onPay={() => setShowPayment(true)}
        />
      </div>

      {showPayment && (
        <PaymentModal
          total={cart.total}
          items={cart.toSaleItems()}
          onComplete={handleSaleComplete}
          onClose={() => setShowPayment(false)}
        />
      )}

      {completedSale && (
        <Receipt
          sale={completedSale}
          storeName={storeName}
          onClose={handleNewSale}
        />
      )}

      {weightProduct && (
        <WeightInputModal
          product={weightProduct}
          onConfirm={handleWeightConfirm}
          onClose={() => setWeightProduct(null)}
        />
      )}

      {variosProduct && (
        <PriceInputModal
          product={variosProduct}
          onConfirm={handleVariosConfirm}
          onClose={() => setVariosProduct(null)}
        />
      )}
    </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  offlineBanner: {
    background: "#fef08a",
    color: "#713f12",
    textAlign: "center",
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
    borderBottom: "1px solid #fde047",
  },
  panelHeader: {
    display: "flex",
    gap: 0,
    padding: "6px 10px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  viewBtn: {
    flex: 1,
    padding: "8px 0",
    border: "none",
    borderBottom: "2px solid transparent",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    textAlign: "center",
  },
  viewBtnActive: {
    color: "#0f172a",
    borderBottomColor: "#2563eb",
    fontWeight: 600,
  },
};
