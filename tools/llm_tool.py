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

import llm_processor  # _core/llm_processor.py


class LLMExtractionInput(BaseModel):
    ocr_text: str = Field(description="Raw OCR text extracted from the invoice")
    filename: str = Field(default="", description="Invoice filename for trace logging")
    image_path: str = Field(
        default="",
        description=(
            "Absolute path to the original invoice file (PDF or image). "
            "When provided, the image is sent to the LLM alongside the OCR text "
            "for vision-capable models, improving extraction accuracy."
        ),
    )


class LLMExtractionTool(BaseTool):
    name: str = "invoice_llm_extractor"
    description: str = (
        "Sends raw OCR text to the configured LLM provider (Ollama/Gemini/OpenAI) "
        "and returns a structured invoice JSON string. "
        "Pass image_path (the original invoice file path) so the LLM can also see the image "
        "if it supports vision. "
        "Trace logs are saved automatically to invoice_traces/."
    )
    args_schema: Type[BaseModel] = LLMExtractionInput

    def _run(self, ocr_text: str, filename: str = "", image_path: str = "") -> str:
        try:
            parsed = llm_processor.parse_invoice_text(
                ocr_text,
                filename=filename or None,
                image_path=image_path or None,
            )
            return json.dumps(parsed, ensure_ascii=False)
        except Exception as e:
            return f"ERROR: LLM extraction failed: {e}"
