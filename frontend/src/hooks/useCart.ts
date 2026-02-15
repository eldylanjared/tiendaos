import { useState, useCallback, useMemo } from "react";
import type { Product, CartItem, SaleItemCreate } from "@/types";

const TAX_RATE = 0.16;

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addProduct = useCallback((product: Product, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        const item = { ...updated[idx] };
        item.quantity += qty;
        item.line_total =
          Math.round(item.product.price * item.quantity * (1 - item.discount_percent / 100) * 100) / 100;
        updated[idx] = item;
        return updated;
      }
      const lineTotal = Math.round(product.price * qty * 100) / 100;
      return [...prev, { product, quantity: qty, discount_percent: 0, line_total: lineTotal }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const lineTotal =
          Math.round(item.product.price * quantity * (1 - item.discount_percent / 100) * 100) / 100;
        return { ...item, quantity, line_total: lineTotal };
      })
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
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
      })),
    [items]
  );

  return { items, addProduct, updateQuantity, removeItem, clearCart, subtotal, tax, total, toSaleItems };
}
