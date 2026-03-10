import { useState, useCallback, useMemo } from "react";
import type { Product, CartItem, SaleItemCreate, VolumePromo } from "@/types";

const TAX_RATE = 0;

/**
 * Calculate effective unit price using greedy bundle matching.
 * Promos are sorted by min_units desc (best deals first).
 * promo_price = total bundle price (e.g. 6 for $55 → promo_price=55).
 */
function calcBundleUnitPrice(totalQty: number, basePrice: number, promos: VolumePromo[]): number {
  if (!promos.length || totalQty <= 0) return basePrice;
  const sorted = [...promos].sort((a, b) => b.min_units - a.min_units);
  let remaining = totalQty;
  let bundleTotal = 0;
  for (const promo of sorted) {
    if (remaining >= promo.min_units) {
      const bundles = Math.floor(remaining / promo.min_units);
      bundleTotal += bundles * promo.promo_price;
      remaining -= bundles * promo.min_units;
    }
  }
  bundleTotal += remaining * basePrice;
  return bundleTotal / totalQty;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addProduct = useCallback((product: Product, qty = 1, packUnits = 1, packPrice: number | null = null) => {
    const key = `${product.id}-${packUnits}`;
    setItems((prev) => {
      let updated: CartItem[];
      const idx = prev.findIndex((i) => `${i.product.id}-${i.pack_units}` === key);
      if (idx >= 0) {
        updated = [...prev];
        const item = { ...updated[idx] };
        item.quantity += qty;
        const unitPrice = packPrice ?? product.price;
        item.line_total =
          Math.round(unitPrice * item.quantity * (1 - item.discount_percent / 100) * 100) / 100;
        updated[idx] = item;
      } else {
        const unitPrice = packPrice ?? product.price;
        const lineTotal = Math.round(unitPrice * qty * 100) / 100;
        updated = [...prev, {
          product,
          quantity: qty,
          discount_percent: 0,
          line_total: lineTotal,
          pack_units: packUnits,
          pack_price: packPrice,
        }];
      }
      return applyVolumePromos(updated);
    });
  }, []);

  const cartKey = (item: CartItem) => `${item.product.id}-${item.pack_units}`;

  const updateQuantity = useCallback((productId: string, packUnits: number, quantity: number) => {
    const key = `${productId}-${packUnits}`;
    if (quantity <= 0) {
      setItems((prev) => applyVolumePromos(prev.filter((i) => cartKey(i) !== key)));
      return;
    }
    setItems((prev) =>
      applyVolumePromos(
        prev.map((item) => {
          if (cartKey(item) !== key) return item;
          const unitPrice = item.pack_price ?? item.product.price;
          const lineTotal =
            Math.round(unitPrice * quantity * (1 - item.discount_percent / 100) * 100) / 100;
          return { ...item, quantity, line_total: lineTotal };
        })
      )
    );
  }, []);

  const removeItem = useCallback((productId: string, packUnits: number) => {
    const key = `${productId}-${packUnits}`;
    setItems((prev) => applyVolumePromos(prev.filter((i) => cartKey(i) !== key)));
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

/**
 * Recalculate line_total for single-unit items that have volume promos.
 * Groups by product_id to get total quantity, then applies greedy bundle pricing.
 */
function applyVolumePromos(items: CartItem[]): CartItem[] {
  // Collect total qty per product (single-unit, non-weight only)
  const productQty: Record<string, number> = {};
  for (const item of items) {
    if (item.pack_units === 1 && !item.product.sell_by_weight) {
      productQty[item.product.id] = (productQty[item.product.id] || 0) + item.quantity;
    }
  }

  return items.map((item) => {
    if (item.pack_units !== 1 || item.product.sell_by_weight) return item;
    const promos = item.product.volume_promos || [];
    if (promos.length === 0) return item;

    const totalQty = productQty[item.product.id] || item.quantity;
    const effectiveUnitPrice = calcBundleUnitPrice(totalQty, item.product.price, promos);
    const lineTotal = Math.round(effectiveUnitPrice * item.quantity * (1 - item.discount_percent / 100) * 100) / 100;
    return { ...item, line_total: lineTotal };
  });
}
