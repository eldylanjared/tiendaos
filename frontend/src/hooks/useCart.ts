import { useState, useCallback, useMemo } from "react";
import type { Product, CartItem, SaleItemCreate } from "@/types";

const TAX_RATE = 0.16;

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addProduct = useCallback((product: Product, qty = 1, packUnits = 1, packPrice: number | null = null) => {
    const key = `${product.id}-${packUnits}`;
    setItems((prev) => {
      const idx = prev.findIndex((i) => `${i.product.id}-${i.pack_units}` === key);
      if (idx >= 0) {
        const updated = [...prev];
        const item = { ...updated[idx] };
        item.quantity += qty;
        const unitPrice = packPrice ?? product.price;
        item.line_total =
          Math.round(unitPrice * item.quantity * (1 - item.discount_percent / 100) * 100) / 100;
        updated[idx] = item;
        return updated;
      }
      const unitPrice = packPrice ?? product.price;
      const lineTotal = Math.round(unitPrice * qty * 100) / 100;
      return [...prev, {
        product,
        quantity: qty,
        discount_percent: 0,
        line_total: lineTotal,
        pack_units: packUnits,
        pack_price: packPrice,
      }];
    });
  }, []);

  const cartKey = (item: CartItem) => `${item.product.id}-${item.pack_units}`;

  const updateQuantity = useCallback((productId: string, packUnits: number, quantity: number) => {
    const key = `${productId}-${packUnits}`;
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => cartKey(i) !== key));
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        if (cartKey(item) !== key) return item;
        const unitPrice = item.pack_price ?? item.product.price;
        const lineTotal =
          Math.round(unitPrice * quantity * (1 - item.discount_percent / 100) * 100) / 100;
        return { ...item, quantity, line_total: lineTotal };
      })
    );
  }, []);

  const removeItem = useCallback((productId: string, packUnits: number) => {
    const key = `${productId}-${packUnits}`;
    setItems((prev) => prev.filter((i) => cartKey(i) !== key));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.line_total, 0), [items]);
  const tax = useMemo(() => Math.round(subtotal * TAX_RATE * 100) / 100, [subtotal]);
  const total = useMemo(() => Math.round((subtotal + tax) * 100) / 100, [subtotal, tax]);

  const toSaleItems = useCallback(
    (): SaleItemCreate[] =>
      items.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
        discount_percent: i.discount_percent,
        pack_units: i.pack_units,
      })),
    [items]
  );

  return { items, addProduct, updateQuantity, removeItem, clearCart, subtotal, tax, total, toSaleItems };
}
