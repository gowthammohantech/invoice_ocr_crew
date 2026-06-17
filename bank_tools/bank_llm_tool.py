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

import bank_llm_processor


class BankLLMExtractionInput(BaseModel):
    ocr_text:   str = Field(description="Raw OCR text extracted from the bank statement")
    filename:   str = Field(default="", description="Original filename (used for vision and trace logging)")
    image_path: str = Field(default="", description="Path to original file for vision-capable models")


class BankLLMExtractionTool(BaseTool):
    name: str = "bank_statement_llm_extractor"
    description: str = (
        "Parses raw OCR text from a bank statement into a structured JSON object "
        "containing account info, statement period, balances, and transaction list. "
        "Returns a raw JSON string."
    )
    args_schema: Type[BaseModel] = BankLLMExtractionInput

    def _run(self, ocr_text: str, filename: str = "", image_path: str = "") -> str:
        parsed = bank_llm_processor.parse_bank_statement(
            ocr_text,
            filename=filename or None,
            image_path=image_path or None,
        )
        return json.dumps(parsed, ensure_ascii=False)
