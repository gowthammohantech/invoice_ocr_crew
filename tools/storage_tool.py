import json
import re
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


def _extract_json(text: str) -> dict | None:
    """Parse JSON from raw text or text wrapped in markdown/explanation."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Strip markdown fences then retry
    stripped = re.sub(r"^```[a-zA-Z]*\n?", "", text)
    stripped = re.sub(r"\n?```$", "", stripped).strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    # Extract the first {...} block from mixed text
    m = re.search(r"\{[\s\S]+\}", text)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    return None


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
        data = _extract_json(invoice_json)
        if data is None:
            return f"ERROR: Cannot parse JSON for storage (received {len(invoice_json)} chars): {invoice_json[:200]}"

        validation = data.get("validation") or {}
        # Only route to failed/ when passed is explicitly False
        passed = validation.get("passed") is not False
        status = "pass" if passed else "failed"
        dest_dir = config.JSON_PASS_DIR if passed else config.JSON_FAIL_DIR
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / f"{stem}.json"

        try:
            with open(dest_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            return f"ERROR: Failed to write file: {e}"

        # Save to SQLite
        import traceback as _tb
        filename = f"{stem}.pdf"
        for ext in (".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp", ".heic", ".heif"):
            candidate = config.INVOICES_DIR / f"{stem}{ext}"
            if candidate.exists():
                filename = candidate.name
                break
        try:
            import db as _db
            _db.save_invoice(stem, filename, data, status)
        except Exception as _exc:
            print(f"[StorageTool] DB save failed for {stem}: {_exc}", flush=True)
            _tb.print_exc()
            # Don't re-raise — the file is on disk and migrate_from_files() in
            # server._run_crew's finally block will import it after kickoff.

        return f"Saved to {dest_path} [{status}]"
