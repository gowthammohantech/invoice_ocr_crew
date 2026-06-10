"""
Post-LLM validation and normalization for extracted invoice JSON.

Normalizes numeric fields and runs five reconciliation checks:
  1. sum(line_item.amount) ≈ subtotal
  2. subtotal + tax − discount ≈ grand_total
  3. quantity × unit_price ≈ line_item.amount  (per item)
  4. currency is a consistent 3-letter code
  5. no page-level total accidentally included as a line item
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional

_TOLERANCE_ABS = 0.05   # ₹0.05 / $0.05 rounding slack
_TOLERANCE_REL = 0.01   # 1% relative slack (handles tax rounding on large invoices)


def _tol(reference: float) -> float:
    return max(_TOLERANCE_ABS, abs(reference) * _TOLERANCE_REL)


def _f(val: Any) -> Optional[float]:
    """Coerce a value to float; return None if not possible."""
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _round2(val: Optional[float]) -> Optional[float]:
    return round(val, 2) if val is not None else None


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------

def normalize(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    In-place normalize numeric fields and currency code.
    Returns the same dict for chaining.
    """
    numeric_top = [
        "subtotal", "discount_amount", "tax_amount", "grand_total",
        "cgst_amount", "sgst_amount", "igst_amount",
    ]
    for key in numeric_top:
        data[key] = _round2(_f(data.get(key)))

    currency = data.get("currency")
    if isinstance(currency, str):
        data["currency"] = currency.strip().upper()

    for item in data.get("line_items") or []:
        item["quantity"]   = _round2(_f(item.get("quantity")))
        item["unit_price"] = _round2(_f(item.get("unit_price")))
        item["tax_rate"]   = _round2(_f(item.get("tax_rate")))
        item["amount"]     = _round2(_f(item.get("amount")))

    return data


# ---------------------------------------------------------------------------
# Individual checks
# ---------------------------------------------------------------------------

def _check_line_sum_vs_subtotal(data: Dict) -> dict:
    subtotal   = _f(data.get("subtotal"))
    line_items = data.get("line_items") or []
    amounts    = [_f(i.get("amount")) for i in line_items]

    if subtotal is None:
        return {"name": "line_items_sum_vs_subtotal", "passed": None, "note": "subtotal is null"}
    if not amounts or all(a is None for a in amounts):
        return {"name": "line_items_sum_vs_subtotal", "passed": None, "note": "no line item amounts"}

    computed = round(sum(a for a in amounts if a is not None), 2)
    delta    = abs(computed - subtotal)
    passed   = delta <= _tol(subtotal)
    return {
        "name":     "line_items_sum_vs_subtotal",
        "passed":   passed,
        "expected": subtotal,
        "computed": computed,
        "delta":    round(delta, 4),
    }


def _check_totals_reconciliation(data: Dict) -> dict:
    subtotal   = _f(data.get("subtotal"))
    tax        = _f(data.get("tax_amount"))
    discount   = _f(data.get("discount_amount")) or 0.0
    grand      = _f(data.get("grand_total"))

    if subtotal is None or grand is None:
        return {"name": "totals_reconciliation", "passed": None, "note": "subtotal or grand_total is null"}
    if tax is None:
        # can still check subtotal − discount ≈ grand when no tax
        tax = 0.0

    computed = round(subtotal + tax - discount, 2)
    delta    = abs(computed - grand)
    passed   = delta <= _tol(grand)
    return {
        "name":     "totals_reconciliation",
        "passed":   passed,
        "formula":  "subtotal + tax - discount",
        "expected": grand,
        "computed": computed,
        "delta":    round(delta, 4),
    }


def _check_line_qty_price(data: Dict) -> List[dict]:
    results = []
    for idx, item in enumerate(data.get("line_items") or []):
        qty   = _f(item.get("quantity"))
        price = _f(item.get("unit_price"))
        amt   = _f(item.get("amount"))
        desc  = (item.get("description") or f"item_{idx}")[:60]

        if qty is None or price is None or amt is None:
            results.append({
                "name":   f"qty_x_price[{idx}]",
                "passed": None,
                "item":   desc,
                "note":   "missing quantity, unit_price, or amount",
            })
            continue

        computed = round(qty * price, 2)
        delta    = abs(computed - amt)
        passed   = delta <= _tol(amt)
        results.append({
            "name":     f"qty_x_price[{idx}]",
            "passed":   passed,
            "item":     desc,
            "expected": amt,
            "computed": computed,
            "delta":    round(delta, 4),
        })
    return results


def _check_currency_consistency(data: Dict) -> dict:
    currency = data.get("currency")
    issues   = []

    if not currency:
        issues.append("currency field is null or empty")
    elif not (isinstance(currency, str) and len(currency) == 3 and currency.isalpha()):
        issues.append(f"currency '{currency}' is not a valid 3-letter ISO code")

    passed = len(issues) == 0
    result = {"name": "currency_consistency", "passed": passed}
    if issues:
        result["issues"] = issues
    return result


def _check_no_total_in_line_items(data: Dict) -> dict:
    grand      = _f(data.get("grand_total"))
    subtotal   = _f(data.get("subtotal"))
    line_items = data.get("line_items") or []

    if len(line_items) <= 1:
        return {"name": "no_total_row_in_line_items", "passed": None,
                "note": "single or no line item — check not applicable"}

    suspicious = []
    for idx, item in enumerate(line_items):
        amt  = _f(item.get("amount"))
        desc = (item.get("description") or "")[:60]
        if amt is None:
            continue
        for label, ref in [("grand_total", grand), ("subtotal", subtotal)]:
            if ref is not None and abs(amt - ref) <= _tol(ref):
                suspicious.append({"item_index": idx, "description": desc,
                                   "matches": label, "amount": amt})

    passed = len(suspicious) == 0
    result = {"name": "no_total_row_in_line_items", "passed": passed}
    if suspicious:
        result["suspicious_items"] = suspicious
    return result


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def validate(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run all checks and attach a 'validation' block to *data* in-place.
    Returns the same dict.
    """
    checks: List[dict] = []

    checks.append(_check_line_sum_vs_subtotal(data))
    checks.append(_check_totals_reconciliation(data))
    checks.extend(_check_line_qty_price(data))
    checks.append(_check_currency_consistency(data))
    checks.append(_check_no_total_in_line_items(data))

    # Overall pass: any check with passed=False fails the invoice
    definitive = [c for c in checks if c.get("passed") is not None]
    overall    = all(c["passed"] for c in definitive) if definitive else None

    failed_names = [c["name"] for c in definitive if not c["passed"]]

    data["validation"] = {
        "passed":       overall,
        "failed_checks": failed_names,
        "checks":       checks,
    }
    return data
