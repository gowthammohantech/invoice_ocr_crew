import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

import config

# --- human-readable log file setup ---
_LOG_FILE = config.LOGS_DIR / "llm_traces.log"
_JSONL_FILE = config.LOGS_DIR / "llm_traces.jsonl"

_logger = logging.getLogger("llm_trace")
if not _logger.handlers:
    _logger.setLevel(logging.DEBUG)
    fmt = logging.Formatter(
        fmt="%(asctime)s.%(msecs)03dZ  %(levelname)-5s  [LLM_TRACE]  %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    fmt.converter = lambda *_: datetime.now(timezone.utc).timetuple()

    fh = logging.FileHandler(_LOG_FILE, encoding="utf-8")
    fh.setFormatter(fmt)
    _logger.addHandler(fh)

    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    _logger.addHandler(ch)

    _logger.propagate = False


def new_trace(invoice_file: str | None, provider: str, model: str) -> dict:
    """Create a new trace context. Pass into query_* functions."""
    return {
        "trace_id": uuid.uuid4().hex[:12],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "invoice_file": invoice_file,
        "provider": provider,
        "model": model,
        "duration_ms": None,
        "status": None,
        "request": {},
        "response": {},
        "parsed_json": None,
        "error": None,
    }


def finish_trace(trace: dict, start_ns: int, error: Exception | None = None) -> None:
    """
    Finalise the trace after an LLM call:
    - compute duration
    - set status
    - append one line to llm_traces.jsonl
    - emit a structured log line
    """
    elapsed_ms = (time_ns() - start_ns) // 1_000_000
    trace["duration_ms"] = elapsed_ms

    if error is None:
        trace["status"] = "success"
        level = logging.INFO
    else:
        trace["status"] = "error"
        trace["error"] = {"type": type(error).__name__, "message": str(error)}
        level = logging.ERROR

    # --- JSONL append ---
    try:
        with open(_JSONL_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(trace, ensure_ascii=False) + "\n")
    except Exception as e:
        _logger.warning("Failed to append JSONL trace: %s", e)

    # --- human-readable log line ---
    kv = (
        f"trace_id={trace['trace_id']}"
        f"  provider={trace['provider']}"
        f"  model={trace['model']}"
        f"  invoice={trace['invoice_file'] or '-'}"
        f"  duration_ms={elapsed_ms}"
        f"  status={trace['status']}"
    )
    if error:
        kv += f"  error={type(error).__name__}: {str(error)[:120]}"
    _logger.log(level, kv)


# stdlib import kept at module level
from time import time_ns
