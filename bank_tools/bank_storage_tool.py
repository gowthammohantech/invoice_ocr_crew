import json
import re
import sys
import traceback as _tb
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

import config


def _extract_json(text: str) -> dict | None:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    stripped = re.sub(r"^```[a-zA-Z]*\n?", "", text)
    stripped = re.sub(r"\n?```$", "", stripped).strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]+\}", text)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    return None


class BankStorageInput(BaseModel):
    statement_json: str = Field(description="Validated bank statement JSON string")
    stem: str = Field(description="Bank statement file stem (filename without extension)")


class BankStorageTool(BaseTool):
    name: str = "bank_statement_storage"
    description: str = (
        "Saves the validated bank statement JSON to disk. "
        "Routes to bank_data/pass/ if validation passed, bank_data/failed/ otherwise. "
        "Returns the absolute path of the saved file."
    )
    args_schema: Type[BaseModel] = BankStorageInput

    def _run(self, statement_json: str, stem: str) -> str:
        data = _extract_json(statement_json)
        if data is None:
            return f"ERROR: Cannot parse JSON for storage ({len(statement_json)} chars): {statement_json[:200]}"

        validation = data.get("validation") or {}
        passed     = validation.get("passed") is not False
        status     = "pass" if passed else "failed"
        dest_dir   = config.BANK_DATA_PASS_DIR if passed else config.BANK_DATA_FAIL_DIR
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path  = dest_dir / f"{stem}.json"

        try:
            with open(dest_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            return f"ERROR: Failed to write file: {e}"

        # Derive original filename
        filename = f"{stem}.pdf"
        for ext in config.SUPPORTED_EXTENSIONS:
            candidate = config.BANK_STATEMENTS_DIR / f"{stem}{ext}"
            if candidate.exists():
                filename = candidate.name
                break

        try:
            import db as _db
            _db.save_bank_statement(stem, filename, data, status)
        except Exception as exc:
            print(f"[BankStorageTool] DB save failed for {stem}: {exc}", flush=True)
            _tb.print_exc()

        return f"Saved to {dest_path} [{status}]"
