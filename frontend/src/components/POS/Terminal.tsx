import { useState, useCallback } from "react";
import ProductGrid from "@/components/Products/ProductGrid";
import Cart from "@/components/POS/Cart";
import PaymentModal from "@/components/POS/PaymentModal";
import Receipt from "@/components/POS/Receipt";
import WeightInputModal from "@/components/POS/WeightInputModal";
import { useCart } from "@/hooks/useCart";
import { useBarcode } from "@/hooks/useBarcode";
import { getByBarcode } from "@/services/api";
import type { Product, Sale, BarcodeLookupResult } from "@/types";
import toast from "react-hot-toast";

interface Props {
  storeName: string;
}

export default function Terminal({ storeName }: Props) {
  const cart = useCart();
  const [showPayment, setShowPayment] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [weightProduct, setWeightProduct] = useState<Product | null>(null);

  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      try {
        const result: BarcodeLookupResult = await getByBarcode(barcode);
        const { product, pack } = result;

        if (product.sell_by_weight) {
          setWeightProduct(product);
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

  function handleSelectProduct(product: Product) {
    if (product.sell_by_weight) {
      setWeightProduct(product);
      return;
    }
    cart.addProduct(product);
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
    <div style={styles.container}>
      <div style={styles.productsPanel}>
        <ProductGrid onSelect={handleSelectProduct} />
      </div>
      <div style={styles.cartPanel}>
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
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flex: 1, overflow: "hidden" },
  productsPanel: { flex: 1, overflow: "hidden", background: "#f8fafc" },
  cartPanel: { width: 550, flexShrink: 0 },
};
