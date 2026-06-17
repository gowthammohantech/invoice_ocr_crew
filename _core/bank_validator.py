"""
Post-LLM validation for extracted bank statement JSON.

Five reconciliation checks:
  1. balance_reconciliation    — opening + credits − debits ≈ closing
  2. total_debits_check        — sum(transaction.debit) ≈ total_debits
  3. total_credits_check       — sum(transaction.credit) ≈ total_credits
  4. running_balance_check     — sequential per-row balance consistency
  5. currency_consistency      — 3-letter ISO currency code
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional

_TOLERANCE_ABS = 0.05
_TOLERANCE_REL = 0.01


def _tol(reference: float) -> float:
    return max(_TOLERANCE_ABS, abs(reference) * _TOLERANCE_REL)


def _f(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _round2(val: Optional[float]) -> Optional[float]:
    return round(val, 2) if val is not None else None


def normalize(data: Dict[str, Any]) -> Dict[str, Any]:
    for key in ("opening_balance", "closing_balance", "total_debits", "total_credits"):
        data[key] = _round2(_f(data.get(key)))

    currency = data.get("currency")
    if isinstance(currency, str):
        data["currency"] = currency.strip().upper()

    for txn in data.get("transactions") or []:
        txn["debit"]   = _round2(_f(txn.get("debit")))
        txn["credit"]  = _round2(_f(txn.get("credit")))
        txn["balance"] = _round2(_f(txn.get("balance")))

    return data


# ---------------------------------------------------------------------------
# Individual checks
# ---------------------------------------------------------------------------

def _check_balance_reconciliation(data: Dict) -> dict:
    opening = _f(data.get("opening_balance"))
    closing = _f(data.get("closing_balance"))
    debits  = _f(data.get("total_debits"))
    credits = _f(data.get("total_credits"))

    if opening is None or closing is None:
        return {"name": "balance_reconciliation", "passed": None,
                "note": "opening_balance or closing_balance is null"}
    if debits is None and credits is None:
        return {"name": "balance_reconciliation", "passed": None,
                "note": "total_debits and total_credits are both null"}

    computed = round(opening + (credits or 0.0) - (debits or 0.0), 2)
    delta    = abs(computed - closing)
    passed   = delta <= _tol(closing)
    return {
        "name":     "balance_reconciliation",
        "passed":   passed,
        "formula":  "opening + credits - debits",
        "expected": closing,
        "computed": computed,
        "delta":    round(delta, 4),
    }


def _check_total_debits(data: Dict) -> dict:
    total    = _f(data.get("total_debits"))
    txns     = data.get("transactions") or []
    computed = round(sum(_f(t.get("debit")) or 0.0 for t in txns), 2)

    if total is None:
        return {"name": "total_debits_check", "passed": None,
                "note": "total_debits field is null"}
    if not txns:
        return {"name": "total_debits_check", "passed": None,
                "note": "no transactions"}

    delta  = abs(computed - total)
    passed = delta <= _tol(total)
    return {
        "name":     "total_debits_check",
        "passed":   passed,
        "expected": total,
        "computed": computed,
        "delta":    round(delta, 4),
    }


def _check_total_credits(data: Dict) -> dict:
    total    = _f(data.get("total_credits"))
    txns     = data.get("transactions") or []
    computed = round(sum(_f(t.get("credit")) or 0.0 for t in txns), 2)

    if total is None:
        return {"name": "total_credits_check", "passed": None,
                "note": "total_credits field is null"}
    if not txns:
        return {"name": "total_credits_check", "passed": None,
                "note": "no transactions"}

    delta  = abs(computed - total)
    passed = delta <= _tol(total)
    return {
        "name":     "total_credits_check",
        "passed":   passed,
        "expected": total,
        "computed": computed,
        "delta":    round(delta, 4),
    }


def _check_running_balance(data: Dict) -> dict:
    txns    = data.get("transactions") or []
    opening = _f(data.get("opening_balance"))

    if len(txns) < 2:
        return {"name": "running_balance_check", "passed": None,
                "note": "fewer than 2 transactions — check not applicable"}

    balances = [_f(t.get("balance")) for t in txns]
    if all(b is None for b in balances):
        return {"name": "running_balance_check", "passed": None,
                "note": "no balance column in transactions"}

    mismatches: list[dict] = []
    prev_bal = opening
    for idx, txn in enumerate(txns):
        cur_bal = _f(txn.get("balance"))
        debit   = _f(txn.get("debit"))  or 0.0
        credit  = _f(txn.get("credit")) or 0.0

        if prev_bal is not None and cur_bal is not None:
            expected_bal = round(prev_bal + credit - debit, 2)
            delta        = abs(cur_bal - expected_bal)
            if delta > _tol(cur_bal or 1.0):
                mismatches.append({
                    "row":      idx,
                    "expected": expected_bal,
                    "got":      cur_bal,
                    "delta":    round(delta, 4),
                })
        if cur_bal is not None:
            prev_bal = cur_bal

    passed = len(mismatches) == 0
    result: dict = {"name": "running_balance_check", "passed": passed}
    if mismatches:
        result["mismatches"] = mismatches[:5]  # cap for readability
    return result


def _check_currency(data: Dict) -> dict:
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


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def validate(data: Dict[str, Any]) -> Dict[str, Any]:
    checks: List[dict] = [
        _check_balance_reconciliation(data),
        _check_total_debits(data),
        _check_total_credits(data),
        _check_running_balance(data),
        _check_currency(data),
    ]

    definitive  = [c for c in checks if c.get("passed") is not None]
    overall     = all(c["passed"] for c in definitive) if definitive else None
    failed_names = [c["name"] for c in definitive if not c["passed"]]

    data["validation"] = {
        "passed":        overall,
        "failed_checks": failed_names,
        "checks":        checks,
    }
    return data
