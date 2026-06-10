from __future__ import annotations
from typing import Any, List, Optional
from pydantic import BaseModel


class LineItem(BaseModel):
    description: str
    hsn_sac_code: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    tax_rate: Optional[float] = None
    amount: Optional[float] = None


class ValidationCheck(BaseModel):
    name: str
    passed: Optional[bool] = None


class ValidationResult(BaseModel):
    passed: Optional[bool] = None
    failed_checks: List[str] = []
    checks: List[Any] = []


class InvoiceOutput(BaseModel):
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    vendor_address: Optional[str] = None
    customer_name: Optional[str] = None
    customer_gstin: Optional[str] = None
    po_number: Optional[str] = None
    currency: Optional[str] = None
    subtotal: Optional[float] = None
    discount_amount: Optional[float] = None
    tax_amount: Optional[float] = None
    grand_total: Optional[float] = None
    cgst_amount: Optional[float] = None
    sgst_amount: Optional[float] = None
    igst_amount: Optional[float] = None
    payment_terms: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_swift: Optional[str] = None
    line_items: List[LineItem] = []
    confidence_score: Optional[float] = None
    validation: Optional[ValidationResult] = None
