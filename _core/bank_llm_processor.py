"""
LLM-based extraction for bank reconciliation statements.
Reuses the same provider infrastructure as llm_processor.py but with a
bank-statement-specific JSON schema and path resolution.
"""

import json
from typing import Any, Dict, Optional
from pathlib import Path
from time import time_ns

import config
from trace_logger import new_trace, finish_trace


def get_bank_system_prompt() -> str:
    return (
        "You are an expert bank statement processing system. "
        "Analyze the following OCR text from a bank statement and extract all key fields into structured JSON. "
        "Strictly adhere to this JSON schema:\n"
        "{\n"
        "  \"bank_name\": string or null,\n"
        "  \"account_number\": string or null,\n"
        "  \"account_holder\": string or null,\n"
        "  \"account_type\": string or null (e.g. Savings, Current, Checking),\n"
        "  \"ifsc_code\": string or null,\n"
        "  \"branch\": string or null,\n"
        "  \"address\": string or null,\n"
        "  \"statement_from\": string or null (YYYY-MM-DD),\n"
        "  \"statement_to\": string or null (YYYY-MM-DD),\n"
        "  \"currency\": string or null (3-letter ISO code, e.g. INR, USD, EUR),\n"
        "  \"opening_balance\": float or null,\n"
        "  \"closing_balance\": float or null,\n"
        "  \"total_debits\": float or null,\n"
        "  \"total_credits\": float or null,\n"
        "  \"transactions\": [\n"
        "    {\n"
        "      \"date\": string or null (YYYY-MM-DD),\n"
        "      \"value_date\": string or null (YYYY-MM-DD),\n"
        "      \"description\": string,\n"
        "      \"reference\": string or null,\n"
        "      \"debit\": float or null,\n"
        "      \"credit\": float or null,\n"
        "      \"balance\": float or null\n"
        "    }\n"
        "  ],\n"
        "  \"confidence_score\": float or null (0.0 to 1.0)\n"
        "}\n\n"
        "Rules:\n"
        "- Each transaction must have either debit OR credit (not both), the other should be null.\n"
        "- Dates must be in YYYY-MM-DD format; use null if unparseable.\n"
        "- All numeric values must be floats or null — never strings.\n"
        "- Return ONLY the raw JSON string. No markdown, no explanations."
    )


def _resolve_bank_image_path(image_path: str, filename: Optional[str] = None) -> Path:
    candidates: list[Path] = []
    raw_path = Path(image_path)
    candidates.append(raw_path)
    if not raw_path.is_absolute():
        candidates.append(config.BASE_DIR / raw_path)
        candidates.append(config.BANK_STATEMENTS_DIR / raw_path)

    stems: list[str] = []
    if raw_path.stem:
        stems.append(raw_path.stem)
    if filename:
        name_stem = Path(filename).stem
        if name_stem:
            stems.append(name_stem)

    for stem in dict.fromkeys(stems):
        for suffix in config.SUPPORTED_EXTENSIONS:
            candidates.append(config.BANK_STATEMENTS_DIR / f"{stem}{suffix}")

    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate.resolve()
    return raw_path


def parse_bank_statement(
    ocr_text: str,
    provider: Optional[str] = None,
    filename: Optional[str] = None,
    image_path: Optional[str] = None,
) -> Dict[str, Any]:
    if not ocr_text.strip():
        raise ValueError("OCR text is empty. Cannot parse bank statement.")

    # Import shared LLM query functions from llm_processor (same _core/ dir on sys.path)
    from llm_processor import (
        query_ollama, query_gemini, query_openai,
        clean_json_response, _file_to_base64_images,
    )

    selected_provider = provider or config.LLM_PROVIDER
    system_prompt = get_bank_system_prompt()

    if selected_provider == "ollama":
        model_name = config.OLLAMA_MODEL
    elif selected_provider == "ollama_cloud":
        if not config.OLLAMA_CLOUD_API_URL:
            raise ValueError("OLLAMA_CLOUD_API_URL is not set.")
        model_name = config.OLLAMA_CLOUD_MODEL
    elif selected_provider == "gemini":
        model_name = config.GEMINI_MODEL
    elif selected_provider == "openai":
        model_name = config.OPENAI_MODEL
    else:
        model_name = "unknown"

    trace = new_trace(filename, selected_provider, model_name)
    trace["system_prompt"] = system_prompt
    trace["ocr_text"] = ocr_text

    images: Optional[list[str]] = None
    if config.LLM_SEND_IMAGE and image_path:
        try:
            resolved = _resolve_bank_image_path(image_path, filename)
            trace["vision_image_path"] = str(resolved)
            images = _file_to_base64_images(resolved)
            print(f"Vision: sending {len(images)} image(s) alongside OCR text.")
            trace["vision_images_sent"] = len(images)
        except Exception as e:
            print(f"Warning: could not load image for vision — falling back to text only. ({e})")

    print(f"Calling LLM provider '{selected_provider}' for bank statement extraction...")
    start = time_ns()
    caught_error: Optional[Exception] = None

    try:
        if selected_provider == "ollama":
            raw_response = query_ollama(system_prompt, ocr_text, trace, images)
        elif selected_provider == "ollama_cloud":
            raw_response = query_ollama(
                system_prompt, ocr_text, trace, images,
                api_url=config.OLLAMA_CLOUD_API_URL,
                model=config.OLLAMA_CLOUD_MODEL,
                api_key=config.OLLAMA_CLOUD_API_KEY,
            )
        elif selected_provider == "gemini":
            raw_response = query_gemini(system_prompt, ocr_text, trace, images)
        elif selected_provider == "openai":
            raw_response = query_openai(system_prompt, ocr_text, trace, images)
        else:
            raise ValueError(f"Unknown LLM provider: {selected_provider}")

        cleaned = clean_json_response(raw_response)
        parsed = json.loads(cleaned)
        trace["parsed_json"] = parsed
        return parsed

    except Exception as e:
        caught_error = e
        raise
    finally:
        finish_trace(trace, start, caught_error)
        if filename:
            trace_filename = f"{Path(filename).stem}_bank_trace.json"
            trace_path = config.TRACES_DIR / trace_filename
            try:
                with open(trace_path, "w", encoding="utf-8") as f:
                    json.dump(trace, f, indent=2, ensure_ascii=False)
            except Exception as trace_err:
                print(f"Warning: Failed to save bank trace JSON: {trace_err}")
