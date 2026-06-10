import json
import requests
from typing import Dict, Any, Optional
from pathlib import Path

import config
from trace_logger import new_trace, finish_trace
from time import time_ns


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


def query_ollama(prompt: str, ocr_text: str, trace: dict) -> str:
    """
    Sends request to local Ollama instance.
    """
    full_prompt = f"{prompt}\n\nInvoice OCR Text:\n{ocr_text}"
    
    payload = {
        "model": config.OLLAMA_MODEL,
        "messages": [
            {
                "role": "user",
                "content": full_prompt
            }
        ],
        "stream": False,
        "format": "json",  # Force json mode if supported by model/Ollama version
        "options": {
            "temperature": 0.0
        }
    }
    
    trace["request"] = {
        "url": config.OLLAMA_API_URL,
        "headers": {"Content-Type": "application/json"},
        "payload": payload
    }
    
    try:
        response = requests.post(config.OLLAMA_API_URL, json=payload, timeout=60)
        
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
            f"Ollama API request failed. Ensure Ollama is running locally at '{config.OLLAMA_API_URL}'.\nError: {e}"
        )


def query_gemini(prompt: str, ocr_text: str, trace: dict) -> str:
    """
    Sends request to Gemini Developer API.
    """
    if not config.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set in environment or config.py.")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_MODEL}:generateContent?key={config.GEMINI_API_KEY}"
    full_prompt = f"{prompt}\n\nInvoice OCR Text:\n{ocr_text}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": full_prompt
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.0
        }
    }
    
    masked_url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_MODEL}:generateContent?key=***"
    trace["request"] = {
        "url": masked_url,
        "headers": {"Content-Type": "application/json"},
        "payload": payload
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


def query_openai(prompt: str, ocr_text: str, trace: dict) -> str:
    """
    Sends request to OpenAI Chat Completions API.
    """
    if not config.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not set in environment or config.py.")
        
    full_prompt = f"{prompt}\n\nInvoice OCR Text:\n{ocr_text}"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config.OPENAI_API_KEY}"
    }
    
    payload = {
        "model": config.OPENAI_MODEL,
        "messages": [
            {
                "role": "user",
                "content": full_prompt
            }
        ],
        "response_format": {
            "type": "json_object"
        },
        "temperature": 0.0
    }
    
    trace["request"] = {
        "url": config.OPENAI_API_URL,
        "headers": {
            "Content-Type": "application/json",
            "Authorization": "Bearer ***"
        },
        "payload": payload
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


def parse_invoice_text(ocr_text: str, provider: Optional[str] = None, filename: Optional[str] = None) -> Dict[str, Any]:
    """
    Calls the selected LLM provider to extract invoice data as structured JSON.
    Emits a structured log line + appends to logs/llm_traces.jsonl via finish_trace.
    Also saves a per-invoice detail trace to invoice_traces/.
    """
    if not ocr_text.strip():
        raise ValueError("OCR text is empty. Cannot parse invoice.")

    selected_provider = provider or config.LLM_PROVIDER
    system_prompt = get_system_prompt()

    if selected_provider == "ollama":
        model_name = config.OLLAMA_MODEL
    elif selected_provider == "gemini":
        model_name = config.GEMINI_MODEL
    elif selected_provider == "openai":
        model_name = config.OPENAI_MODEL
    else:
        model_name = "unknown"

    trace = new_trace(filename, selected_provider, model_name)
    trace["system_prompt"] = system_prompt
    trace["ocr_text"] = ocr_text

    print(f"Calling LLM provider '{selected_provider}' for reasoning...")
    start = time_ns()
    caught_error: Optional[Exception] = None

    try:
        if selected_provider == "ollama":
            raw_response = query_ollama(system_prompt, ocr_text, trace)
        elif selected_provider == "gemini":
            raw_response = query_gemini(system_prompt, ocr_text, trace)
        elif selected_provider == "openai":
            raw_response = query_openai(system_prompt, ocr_text, trace)
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
