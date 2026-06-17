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

import config
import ocr_processor


class BankOCRInput(BaseModel):
    file_path: str = Field(description="Absolute path to the bank statement PDF or image file")


class BankOCRTool(BaseTool):
    name: str = "bank_statement_ocr_extractor"
    description: str = (
        "Extracts raw text from a bank statement file (PDF or image) using OCR. "
        "Input: absolute file path. "
        "Output: raw OCR text with '--- PAGE N ---' markers for multi-page PDFs."
    )
    args_schema: Type[BaseModel] = BankOCRInput

    def _run(self, file_path: str) -> str:
        path = Path(file_path)
        if not path.exists():
            return f"ERROR: File not found: {file_path}"
        try:
            raw_text = ocr_processor.extract_raw_text(path)
        except Exception as e:
            return f"ERROR: OCR failed on '{path.name}': {e}"

        if not raw_text.strip():
            return "ERROR: OCR produced no text from the file."

        try:
            config.BANK_RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
            raw_path = config.BANK_RAW_DATA_DIR / f"{path.stem}.txt"
            raw_path.write_text(raw_text, encoding="utf-8")
        except Exception:
            pass

        return raw_text
