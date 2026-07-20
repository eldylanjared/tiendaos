import { useState, useCallback, useMemo } from "react";
import type { Product, CartItem, SaleItemCreate, VolumePromo } from "@/types";

const TAX_RATE = 0;

/**
 * Effective unit price for totalQty units, choosing the CHEAPEST combination of
 * promo bundles and singles (dynamic programming — greedy largest-tier-first
 * overcharges, e.g. tiers 6/$105 + 8/$135 + 10/$170 price 16 units as 10+6=$275
 * instead of 8+8=$270). promo_price = total bundle price.
 * Mirrors backend app/services/pricing.py (bundle_total) — keep both in sync.
 */
function calcBundleUnitPrice(totalQty: number, basePrice: number, promos: VolumePromo[]): number {
  if (!promos.length || totalQty <= 0 || !Number.isInteger(totalQty)) return basePrice;
  const cost = new Array<number>(totalQty + 1).fill(Infinity);
  cost[0] = 0;
  for (let q = 1; q <= totalQty; q++) {
    let best = cost[q - 1] + basePrice;
    for (const p of promos) {
      if (p.min_units > 0 && p.min_units <= q) {
        const candidate = cost[q - p.min_units] + p.promo_price;
        if (candidate < best) best = candidate;
      }
    }
    cost[q] = best;
  }
  return cost[totalQty] / totalQty;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addProduct = useCallback((product: Product, qty = 1, packUnits = 1, packPrice: number | null = null) => {
    const key = `${product.id}-${packUnits}-${packPrice ?? ""}`;
    setItems((prev) => {
      let updated: CartItem[];
      const idx = prev.findIndex((i) => `${i.product.id}-${i.pack_units}-${i.pack_price ?? ""}` === key);
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

  const cartKey = (item: CartItem) => `${item.product.id}-${item.pack_units}-${item.pack_price ?? ""}`;

  const updateQuantity = useCallback((productId: string, packUnits: number, packPrice: number | null, quantity: number) => {
    const key = `${productId}-${packUnits}-${packPrice ?? ""}`;
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

  const removeItem = useCallback((productId: string, packUnits: number, packPrice: number | null) => {
    const key = `${productId}-${packUnits}-${packPrice ?? ""}`;
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
        ...(i.pack_price !== null ? { unit_price: i.pack_price } : {}),
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
