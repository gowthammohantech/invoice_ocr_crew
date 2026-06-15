import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # .env loading is optional; set vars directly in the environment if needed

BASE_DIR = Path(__file__).resolve().parent

# --- Directories ---
INVOICES_DIR  = BASE_DIR / "invoices"
RAW_DATA_DIR  = BASE_DIR / "invoice_raw_data"
JSON_DATA_DIR = BASE_DIR / "invoice_data"
JSON_PASS_DIR = JSON_DATA_DIR / "pass"
JSON_FAIL_DIR = JSON_DATA_DIR / "failed"
TRACES_DIR    = BASE_DIR / "invoice_traces"
LOGS_DIR      = BASE_DIR / "logs"
REFERENCE_DIR = BASE_DIR / "reference"

SUPPORTED_EXTENSIONS = {
    ".pdf", ".heic", ".heif",
    ".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp",
}

# --- OCR ---
# Supported values: "paddleocr", "tesseract", "google_vision", "doctr"
OCR_ENGINE = os.environ.get("OCR_ENGINE", "paddleocr").lower()
OCR_LANG   = os.environ.get("OCR_LANG", "eng")

# Google Vision API auth — pick ONE of the two options below:
#   1. API key  (simplest — create one in GCP Console → APIs & Services → Credentials)
GOOGLE_VISION_API_KEY = os.environ.get("GOOGLE_VISION_API_KEY", "")
#   2. Service-account JSON key file path (leave blank to use Application Default Credentials)
GOOGLE_APPLICATION_CREDENTIALS = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")

# --- LLM ---
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "ollama").lower()

# Ollama — direct HTTP URL used by llm_processor for trace-logged calls
OLLAMA_API_URL = os.environ.get("OLLAMA_API_URL", "http://localhost:11434/api/chat")
OLLAMA_MODEL   = os.environ.get("OLLAMA_MODEL", "gemma4:31b-cloud")

# Separate model for CrewAI agent orchestration — must support tool/function calling.
# qwen2.5vl and other vision models often lack tool support; use a chat model here.
CREW_AGENT_MODEL = os.environ.get("CREW_AGENT_MODEL", OLLAMA_MODEL)

# LiteLLM needs the Ollama base (no /api/chat path)
_ollama_base = OLLAMA_API_URL.replace("/api/chat", "").rstrip("/")
os.environ.setdefault("OLLAMA_API_BASE", _ollama_base)

# Gemini
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL   = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")

# OpenAI
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL   = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_API_URL = os.environ.get("OPENAI_API_URL", "https://api.openai.com/v1/chat/completions")

# --- Vision ---
# When true, the original invoice image is sent alongside OCR text if the LLM supports it.
# Set LLM_SEND_IMAGE=false to disable (e.g. for text-only models or to reduce token usage).
LLM_SEND_IMAGE = os.environ.get("LLM_SEND_IMAGE", "true").lower() == "true"


def get_litellm_model_string() -> str:
    """Returns a LiteLLM-compatible model string for crewai Agent(llm=...)."""
    if LLM_PROVIDER == "ollama":
        return f"ollama/{OLLAMA_MODEL}"
    elif LLM_PROVIDER == "gemini":
        return f"gemini/{GEMINI_MODEL}"
    elif LLM_PROVIDER == "openai":
        return f"openai/{OPENAI_MODEL}"
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {LLM_PROVIDER!r}. Use 'ollama', 'gemini', or 'openai'.")
