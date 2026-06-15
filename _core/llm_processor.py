import base64
import io
import json
import requests
from typing import Dict, Any, Optional
from pathlib import Path

import config
from trace_logger import new_trace, finish_trace
from time import time_ns

try:
    from PIL import Image as _PILImage
    from pdf2image import convert_from_path as _convert_from_path
    _VISION_DEPS = True
except ImportError:
    _VISION_DEPS = False


def _file_to_base64_images(file_path: Path) -> list[str]:
    """Convert an invoice file to a list of base64 PNG strings (one per page/image)."""
    if not _VISION_DEPS:
        raise RuntimeError("Pillow and pdf2image are required for vision support.")
    suffix = file_path.suffix.lower()
    results: list[str] = []
    if suffix == ".pdf":
        pages = _convert_from_path(str(file_path), dpi=150, thread_count=1)
        for page in pages:
            buf = io.BytesIO()
            page.save(buf, format="PNG")
            results.append(base64.b64encode(buf.getvalue()).decode())
    else:
        with _PILImage.open(file_path) as img:
            buf = io.BytesIO()
            img.convert("RGB").save(buf, format="PNG")
            results.append(base64.b64encode(buf.getvalue()).decode())
    return results


def get_system_prompt() -> str:
    """
    Returns the system prompt with target JSON schema instructions.
    """
    return (
        "You are an expert invoice processing system. "
        "Analyze the following OCR text from an invoice and extract all key fields into a structured JSON format. "
        "Strictly adhere to the following JSON schema: "
        "{\n"
        "  \"invoice_number\": string or null,\n"
        "  \"invoice_date\": string or null (YYYY-MM-DD format if possible),\n"
        "  \"due_date\": string or null (YYYY-MM-DD format if possible),\n"
        "  \"vendor_name\": string or null,\n"
        "  \"vendor_gstin\": string or null,\n"
        "  \"vendor_address\": string or null,\n"
        "  \"customer_name\": string or null,\n"
        "  \"customer_gstin\": string or null,\n"
        "  \"po_number\": string or null,\n"
        "  \"currency\": string or null (3-letter code, e.g. USD, EUR, INR),\n"
        "  \"subtotal\": float or null,\n"
        "  \"discount_amount\": float or null,\n"
        "  \"tax_amount\": float or null,\n"
        "  \"grand_total\": float or null,\n"
        "  \"cgst_amount\": float or null,\n"
        "  \"sgst_amount\": float or null,\n"
        "  \"igst_amount\": float or null,\n"
        "  \"payment_terms\": string or null,\n"
        "  \"bank_name\": string or null,\n"
        "  \"account_number\": string or null,\n"
        "  \"ifsc_swift\": string or null,\n"
        "  \"line_items\": [\n"
        "    {\n"
        "      \"description\": string,\n"
        "      \"hsn_sac_code\": string or null,\n"
        "      \"quantity\": float or null,\n"
        "      \"unit_price\": float or null,\n"
        "      \"tax_rate\": float or null,\n"
        "      \"amount\": float or null\n"
        "    }\n"
        "  ],\n"
        "  \"confidence_score\": float or null (value from 0.0 to 1.0 representing your extraction confidence),\n"
        "}\n\n"
        "Return ONLY the raw JSON string. Do not include explanations, intro text, or markdown code blocks."
    )


def clean_json_response(response_text: str) -> str:
    """
    Cleans any markdown wrapper (e.g. ```json ... ```) from the LLM output.
    """
    text = response_text.strip()
    if text.startswith("```"):
        # Remove starting ```json or ```
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def query_ollama(
    prompt: str,
    ocr_text: str,
    trace: dict,
    images: Optional[list[str]] = None,
    api_url: Optional[str] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> str:
    """
    Sends request to an Ollama instance (local or remote cloud).
    api_url/model/api_key default to the local Ollama config values when not provided.
    """
    _url     = api_url  or config.OLLAMA_API_URL
    _model   = model    or config.OLLAMA_MODEL
    _api_key = api_key  if api_key is not None else config.OLLAMA_API_KEY

    full_prompt = f"{prompt}\n\nInvoice OCR Text:\n{ocr_text}"

    message: dict = {"role": "user", "content": full_prompt}
    if images:
        message["images"] = images

    payload = {
        "model": _model,
        "messages": [message],
        "stream": False,
        "format": "json",  # Force json mode if supported by model/Ollama version
        "options": {
            "temperature": 0.0
        }
    }

    headers: dict = {"Content-Type": "application/json"}
    if _api_key:
        headers["Authorization"] = f"Bearer {_api_key}"

    trace["request"] = {
        "url": _url,
        "headers": {**headers, "Authorization": "Bearer ***"} if _api_key else headers,
        "payload": {**payload, "messages": [{**message, "images": f"[{len(images)} image(s) omitted]"} if images else message]},
    }

    try:
        response = requests.post(_url, json=payload, headers=headers, timeout=60)

        trace["response"] = {
            "status_code": response.status_code,
            "raw_body": response.text
        }

        response.raise_for_status()
        result = response.json()
        # Ollama chat API returns {"message": {"content": "..."}}
        # generate API returns {"response": "..."}
        if "message" in result:
            return result["message"]["content"]
        elif "response" in result:
            return result["response"]
        else:
            raise KeyError(f"Unexpected response structure from Ollama: {result}")
    except requests.exceptions.RequestException as e:
        if "response" not in trace and 'response' in locals():
            trace["response"] = {
                "status_code": response.status_code,
                "raw_body": response.text
            }
        raise ConnectionError(
            f"Ollama API request failed at '{_url}'.\nError: {e}"
        )


def query_gemini(prompt: str, ocr_text: str, trace: dict, images: Optional[list[str]] = None) -> str:
    """
    Sends request to Gemini Developer API.
    Passes base64 images as inline_data parts when provided.
    """
    if not config.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set in environment or config.py.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_MODEL}:generateContent?key={config.GEMINI_API_KEY}"
    full_prompt = f"{prompt}\n\nInvoice OCR Text:\n{ocr_text}"

    parts: list[dict] = [{"text": full_prompt}]
    if images:
        for b64 in images:
            parts.append({"inline_data": {"mime_type": "image/png", "data": b64}})

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.0
        }
    }

    trace_parts = [{"text": full_prompt}]
    if images:
        trace_parts.append({"inline_data": f"[{len(images)} image(s) omitted]"})

    masked_url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_MODEL}:generateContent?key=***"
    trace["request"] = {
        "url": masked_url,
        "headers": {"Content-Type": "application/json"},
        "payload": {"contents": [{"parts": trace_parts}], "generationConfig": payload["generationConfig"]},
    }
    
    try:
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=30)
        
        trace["response"] = {
            "status_code": response.status_code,
            "raw_body": response.text
        }
        
        response.raise_for_status()
        result = response.json()
        return result["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        if "response" not in trace and 'response' in locals():
            trace["response"] = {
                "status_code": response.status_code,
                "raw_body": response.text
            }
        raise ValueError(f"Failed to parse response structure from Gemini API: {e}")


def query_openai(prompt: str, ocr_text: str, trace: dict, images: Optional[list[str]] = None) -> str:
    """
    Sends request to OpenAI Chat Completions API.
    Passes base64 images as image_url content blocks when provided (requires a vision-capable model).
    """
    if not config.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not set in environment or config.py.")

    full_prompt = f"{prompt}\n\nInvoice OCR Text:\n{ocr_text}"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config.OPENAI_API_KEY}"
    }

    if images:
        content: Any = [{"type": "text", "text": full_prompt}]
        for b64 in images:
            content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}})
        trace_content: Any = [{"type": "text", "text": full_prompt}, {"type": "image_url", "image_url": f"[{len(images)} image(s) omitted]"}]
    else:
        content = full_prompt
        trace_content = full_prompt

    payload = {
        "model": config.OPENAI_MODEL,
        "messages": [{"role": "user", "content": content}],
        "response_format": {"type": "json_object"},
        "temperature": 0.0
    }

    trace["request"] = {
        "url": config.OPENAI_API_URL,
        "headers": {
            "Content-Type": "application/json",
            "Authorization": "Bearer ***"
        },
        "payload": {**payload, "messages": [{"role": "user", "content": trace_content}]},
    }
    
    try:
        response = requests.post(config.OPENAI_API_URL, json=payload, headers=headers, timeout=30)
        
        trace["response"] = {
            "status_code": response.status_code,
            "raw_body": response.text
        }
        
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"]
    except Exception as e:
        if "response" not in trace and 'response' in locals():
            trace["response"] = {
                "status_code": response.status_code,
                "raw_body": response.text
            }
        raise ValueError(f"Failed to parse response structure from OpenAI API: {e}")


def parse_invoice_text(
    ocr_text: str,
    provider: Optional[str] = None,
    filename: Optional[str] = None,
    image_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Calls the selected LLM provider to extract invoice data as structured JSON.
    When image_path is provided and LLM_SEND_IMAGE is true, the original invoice
    image(s) are sent alongside the OCR text for vision-capable models.
    """
    if not ocr_text.strip():
        raise ValueError("OCR text is empty. Cannot parse invoice.")

    selected_provider = provider or config.LLM_PROVIDER
    system_prompt = get_system_prompt()

    if selected_provider == "ollama":
        model_name = config.OLLAMA_MODEL
    elif selected_provider == "ollama_cloud":
        if not config.OLLAMA_CLOUD_API_URL:
            raise ValueError("OLLAMA_CLOUD_API_URL is not set. Configure it to use the 'ollama_cloud' provider.")
        if not config.OLLAMA_CLOUD_MODEL:
            raise ValueError("OLLAMA_CLOUD_MODEL is not set. Configure it to use the 'ollama_cloud' provider.")
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
            images = _file_to_base64_images(Path(image_path))
            print(f"Vision: sending {len(images)} image(s) alongside OCR text.")
            trace["vision_images_sent"] = len(images)
        except Exception as e:
            print(f"Warning: could not load image for vision — falling back to text only. ({e})")

    print(f"Calling LLM provider '{selected_provider}' for reasoning...")
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

        cleaned_response = clean_json_response(raw_response)
        parsed_json = json.loads(cleaned_response)
        trace["parsed_json"] = parsed_json
        return parsed_json

    except Exception as e:
        caught_error = e
        raise
    finally:
        finish_trace(trace, start, caught_error)
        if filename:
            trace_filename = f"{Path(filename).stem}_trace.json"
            trace_path = config.TRACES_DIR / trace_filename
            try:
                with open(trace_path, "w", encoding="utf-8") as f:
                    json.dump(trace, f, indent=2, ensure_ascii=False)
            except Exception as trace_err:
                print(f"Warning: Failed to save trace JSON: {trace_err}")
