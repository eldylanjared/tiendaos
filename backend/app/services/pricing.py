"""Volume promo (bundle) pricing.

promo_price is the TOTAL price for min_units (e.g. 8 for $135 → promo_price=135).
The frontend mirrors this algorithm in useCart.ts (calcBundleUnitPrice) — keep both in sync.
"""


def bundle_total(total_qty: int, base_price: float, promos) -> float:
    """Cheapest total for total_qty units, combining promo bundles and singles.

    Greedy largest-tier-first is wrong: with tiers 6/$105, 8/$135, 10/$170,
    16 units greedily splits 10+6 = $275, but 8+8 = $270 is what the customer
    was promised buying two 8-packs. Dynamic programming finds the optimum.
    """
    if total_qty <= 0:
        return 0.0
    tiers = [(p.min_units, p.promo_price) for p in promos if p.min_units > 0]
    if not tiers:
        return total_qty * base_price
    INF = float("inf")
    cost = [0.0] + [INF] * total_qty
    for q in range(1, total_qty + 1):
        best = cost[q - 1] + base_price
        for min_units, promo_price in tiers:
            if min_units <= q:
                candidate = cost[q - min_units] + promo_price
                if candidate < best:
                    best = candidate
        cost[q] = best
    return cost[total_qty]
