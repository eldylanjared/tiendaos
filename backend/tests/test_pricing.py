"""Volume promo bundle pricing: optimal combination, not greedy largest-tier-first."""
import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.pricing import bundle_total


def _promos(*tiers):
    return [SimpleNamespace(min_units=u, promo_price=p) for u, p in tiers]

# Corona Golden Light: $20 unit, tiers 6/$105, 8/$135, 10/$170, 24/$405
CORONA = _promos((6, 105.0), (8, 135.0), (10, 170.0), (24, 405.0))


def test_two_eight_packs_beat_greedy_split():
    # greedy picks 10+6 = 275; correct is 8+8 = 270
    assert bundle_total(16, 20.0, CORONA) == 270.0


def test_below_smallest_tier_uses_base_price():
    assert bundle_total(5, 20.0, CORONA) == 100.0


def test_exact_tiers():
    assert bundle_total(6, 20.0, CORONA) == 105.0
    assert bundle_total(8, 20.0, CORONA) == 135.0
    assert bundle_total(24, 20.0, CORONA) == 405.0


def test_tier_plus_singles():
    # 7 = 6-pack + 1 single (105 + 20) beats 7 singles (140)
    assert bundle_total(7, 20.0, CORONA) == 125.0


def test_promo_worse_than_singles_is_ignored():
    # "promo" 6/$150 is worse than 6 singles at $20 = $120
    assert bundle_total(6, 20.0, _promos((6, 150.0))) == 120.0


def test_no_promos_and_zero_qty():
    assert bundle_total(4, 20.0, []) == 80.0
    assert bundle_total(0, 20.0, CORONA) == 0.0
