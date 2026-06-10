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

import config  # crew's own config.py


class StorageInput(BaseModel):
    invoice_json: str = Field(description="Validated invoice JSON string")
    stem: str = Field(description="Invoice file stem (filename without extension)")


class StorageTool(BaseTool):
    name: str = "invoice_storage"
    description: str = (
        "Saves the validated invoice JSON to disk. "
        "Routes to invoice_data/pass/ if validation passed, invoice_data/failed/ otherwise. "
        "Returns the absolute path of the saved file."
    )
    args_schema: Type[BaseModel] = StorageInput

    def _run(self, invoice_json: str, stem: str) -> str:
        try:
            data = json.loads(invoice_json)
        except json.JSONDecodeError as e:
            return f"ERROR: Cannot parse JSON for storage: {e}"

        validation = data.get("validation") or {}
        # Only route to failed/ when passed is explicitly False
        passed = validation.get("passed") is not False
        dest_dir = config.JSON_PASS_DIR if passed else config.JSON_FAIL_DIR
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / f"{stem}.json"

        try:
            with open(dest_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            status = "pass" if passed else "failed"
            return f"Saved to {dest_path} [{status}]"
        except Exception as e:
            return f"ERROR: Failed to write file: {e}"
