import json
import sys
from pathlib import Path
from typing import Type

from pydantic import BaseModel, Field
from crewai.tools import BaseTool

_HERE         = Path(__file__).resolve().parent
_PROJECT_ROOT = _HERE.parent
_CORE_DIR     = _PROJECT_ROOT / "_core"
for _p in [str(_PROJECT_ROOT), str(_CORE_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

import bank_validator


class BankValidatorInput(BaseModel):
    statement_json: str = Field(description="Extracted bank statement JSON string")


class BankValidatorTool(BaseTool):
    name: str = "bank_statement_validator"
    description: str = (
        "Runs 5 reconciliation checks on extracted bank statement data: "
        "balance reconciliation, total debits/credits verification, "
        "running balance consistency, and currency validation. "
        "Returns the JSON string with a 'validation' block attached."
    )
    args_schema: Type[BaseModel] = BankValidatorInput

    def _run(self, statement_json: str) -> str:
        try:
            data = json.loads(statement_json)
        except json.JSONDecodeError as e:
            return f"ERROR: Invalid JSON input: {e}"
        bank_validator.normalize(data)
        bank_validator.validate(data)
        return json.dumps(data, ensure_ascii=False)
