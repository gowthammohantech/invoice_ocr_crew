import json
import sys
from pathlib import Path
from typing import Type

from pydantic import BaseModel, Field
from crewai.tools import BaseTool

_HERE = Path(__file__).resolve().parent
_PROJECT_ROOT = _HERE.parent
_CORE_DIR = _PROJECT_ROOT / "_core"
for _p in [str(_PROJECT_ROOT), str(_CORE_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

import validator as invoice_validator  # _core/validator.py


class ValidatorInput(BaseModel):
    invoice_json: str = Field(description="JSON string of the extracted invoice data")


class ValidatorTool(BaseTool):
    name: str = "invoice_validator"
    description: str = (
        "Validates extracted invoice JSON using 5 reconciliation checks: "
        "(1) line items sum vs subtotal, (2) totals reconciliation, "
        "(3) qty × unit_price per line item, (4) currency code validity, "
        "(5) no page-level totals in line items. "
        "Returns the invoice JSON with a 'validation' block attached."
    )
    args_schema: Type[BaseModel] = ValidatorInput

    def _run(self, invoice_json: str) -> str:
        try:
            data = json.loads(invoice_json)
        except json.JSONDecodeError as e:
            return f"ERROR: Invalid JSON input: {e}"
        try:
            invoice_validator.normalize(data)
            invoice_validator.validate(data)
            return json.dumps(data, ensure_ascii=False)
        except Exception as e:
            return f"ERROR: Validation failed: {e}"
