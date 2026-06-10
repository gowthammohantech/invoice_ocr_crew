"""
FastAPI server for the Invoice OCR CrewAI pipeline.

Auth flow:
  POST /auth/login          — exchange APP_ACCESS_TOKEN for a 24-hour JWT

Invoice processing (SSE):
  POST /api/process         — upload invoice → returns job_id + stream_url immediately
  GET  /api/stream/{id}     — SSE stream of agent execution events (JWT via ?token=)

Read endpoints (all require Bearer JWT):
  GET  /api/job/{id}        — poll job status
  GET  /api/jobs            — list in-memory jobs (this session)
  GET  /api/invoices        — list all saved results (pass + failed)
  GET  /api/invoice/{stem}  — fetch extracted invoice JSON
  GET  /api/raw/{stem}      — get raw OCR text
  GET  /api/traces/{stem}   — per-invoice LLM trace JSON
  GET  /api/logs            — last N lines of llm_traces.jsonl
  GET  /api/reference/{stem}— list reference image filenames
  GET  /health              — health check (public)
"""

from __future__ import annotations

import asyncio
import json
import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import config

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from sse_starlette.sse import EventSourceResponse

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

APP_ACCESS_TOKEN = os.environ.get("APP_ACCESS_TOKEN", "elixir-sandbox-2024")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production-please-use-random-32-chars")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_SECONDS = 86400  # 24 hours

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Elixir Global — Invoice OCR Agent API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_executor = ThreadPoolExecutor(max_workers=2)
_jobs: Dict[str, Dict[str, Any]] = {}
_streams: Dict[str, asyncio.Queue] = {}
_main_loop: Optional[asyncio.AbstractEventLoop] = None

# Thread-local storage so SSE bridge knows which queue to route into
_thread_local = threading.local()

# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def _create_jwt() -> str:
    now = int(datetime.now(timezone.utc).timestamp())
    return jwt.encode(
        {"sub": "api_user", "iat": now, "exp": now + JWT_EXPIRE_SECONDS},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def _verify_jwt(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    token: Optional[str] = Query(None, include_in_schema=False),
) -> str:
    """Accepts Bearer token from Authorization header OR ?token= query param (for SSE)."""
    raw = None
    if credentials:
        raw = credentials.credentials
    elif token:
        raw = token
    if not raw:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = _verify_jwt(raw)
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ---------------------------------------------------------------------------
# CrewAI SSE event bridge (singleton, registered once at startup)
# ---------------------------------------------------------------------------

class _SSEEventBridge:
    """
    Single global listener. Routes CrewAI events to the per-job asyncio.Queue
    stored in the calling thread's thread-local storage.
    """

    def __init__(self) -> None:
        self._registered = False

    def register(self) -> None:
        if self._registered:
            return
        self._registered = True
        try:
            from crewai.events import (
                BaseEventListener,
                CrewKickoffStartedEvent,
                CrewKickoffCompletedEvent,
                CrewKickoffFailedEvent,
                TaskStartedEvent,
                TaskCompletedEvent,
                TaskFailedEvent,
                ToolUsageStartedEvent,
                ToolUsageFinishedEvent,
                crewai_event_bus,
            )
        except ImportError:
            return

        bridge = self

        @crewai_event_bus.on(CrewKickoffStartedEvent)
        def _crew_started(source: Any, event: CrewKickoffStartedEvent) -> None:
            bridge._emit({
                "type": "crew_started",
                "ts": datetime.now(timezone.utc).isoformat(),
            })

        @crewai_event_bus.on(TaskStartedEvent)
        def _task_started(source: Any, event: TaskStartedEvent) -> None:
            task = event.task
            bridge._emit({
                "type": "task_started",
                "agent_role": _agent_role(task),
                "description": _task_desc(task),
                "ts": datetime.now(timezone.utc).isoformat(),
            })

        @crewai_event_bus.on(TaskCompletedEvent)
        def _task_completed(source: Any, event: TaskCompletedEvent) -> None:
            task = event.task
            raw = str(event.output.raw) if event.output else ""
            bridge._emit({
                "type": "task_completed",
                "agent_role": _agent_role(task),
                "description": _task_desc(task),
                "preview": raw[:200],
                "ts": datetime.now(timezone.utc).isoformat(),
            })

        @crewai_event_bus.on(TaskFailedEvent)
        def _task_failed(source: Any, event: TaskFailedEvent) -> None:
            bridge._emit({
                "type": "task_failed",
                "agent_role": _agent_role(event.task),
                "error": event.error,
                "ts": datetime.now(timezone.utc).isoformat(),
            })

        @crewai_event_bus.on(ToolUsageStartedEvent)
        def _tool_started(source: Any, event: ToolUsageStartedEvent) -> None:
            bridge._emit({
                "type": "tool_started",
                "tool_name": event.tool_name,
                "agent_role": event.agent_role or "",
                "ts": datetime.now(timezone.utc).isoformat(),
            })

        @crewai_event_bus.on(ToolUsageFinishedEvent)
        def _tool_finished(source: Any, event: ToolUsageFinishedEvent) -> None:
            bridge._emit({
                "type": "tool_finished",
                "tool_name": event.tool_name,
                "agent_role": event.agent_role or "",
                "ts": datetime.now(timezone.utc).isoformat(),
            })

        @crewai_event_bus.on(CrewKickoffCompletedEvent)
        def _crew_completed(source: Any, event: CrewKickoffCompletedEvent) -> None:
            job_id = getattr(_thread_local, "job_id", None)
            stem = _jobs.get(job_id, {}).get("stem", "") if job_id else ""
            result_path = _find_result_path(stem)
            bridge._emit({
                "type": "crew_completed",
                "file_stem": stem,
                "result_path": result_path,
                "ts": datetime.now(timezone.utc).isoformat(),
            })
            bridge._emit({"type": "done"})

        @crewai_event_bus.on(CrewKickoffFailedEvent)
        def _crew_failed(source: Any, event: CrewKickoffFailedEvent) -> None:
            bridge._emit({
                "type": "crew_failed",
                "error": str(getattr(event, "error", "unknown error")),
                "ts": datetime.now(timezone.utc).isoformat(),
            })
            bridge._emit({"type": "done"})

    def _emit(self, payload: dict) -> None:
        q = getattr(_thread_local, "queue", None)
        loop = _main_loop
        if q is not None and loop is not None:
            try:
                loop.call_soon_threadsafe(q.put_nowait, payload)
            except Exception:
                pass


def _agent_role(task: Any) -> str:
    if task is None:
        return ""
    agent = getattr(task, "agent", None)
    return getattr(agent, "role", "") if agent else ""


def _task_desc(task: Any) -> str:
    if task is None:
        return ""
    return getattr(task, "name", None) or getattr(task, "description", "")[:120]


def _find_result_path(stem: str) -> str:
    for status, directory in [("pass", config.JSON_PASS_DIR), ("failed", config.JSON_FAIL_DIR)]:
        if (directory / f"{stem}.json").exists():
            return f"{status}/{stem}.json"
    return ""


_sse_bridge = _SSEEventBridge()


@app.on_event("startup")
async def _startup() -> None:
    global _main_loop
    _main_loop = asyncio.get_running_loop()
    _sse_bridge.register()


# ---------------------------------------------------------------------------
# Auth endpoint (public)
# ---------------------------------------------------------------------------

@app.post("/auth/login", summary="Exchange the sandbox token for a 24-hour JWT")
async def login(body: dict) -> dict:
    token = body.get("token", "")
    if token != APP_ACCESS_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid access token")
    return {"access_token": _create_jwt(), "expires_in": JWT_EXPIRE_SECONDS, "token_type": "bearer"}


# ---------------------------------------------------------------------------
# Processing endpoints
# ---------------------------------------------------------------------------

def _run_crew(job_id: str, file_path: Path) -> None:
    """Blocking. Runs in the thread pool with thread-locals set for SSE routing."""
    _thread_local.job_id = job_id
    _thread_local.queue = _streams.get(job_id)

    _jobs[job_id]["status"] = "running"
    try:
        from crew import InvoiceOCRCrew
        result = InvoiceOCRCrew().crew().kickoff(inputs={
            "file_path": str(file_path.resolve()),
            "file_stem": file_path.stem,
        })
        _jobs[job_id].update({"status": "done", "result": str(result)})
    except Exception as e:
        _jobs[job_id].update({"status": "failed", "error": str(e)})
        q = _streams.get(job_id)
        loop = _main_loop
        if q and loop:
            loop.call_soon_threadsafe(q.put_nowait, {"type": "crew_failed", "error": str(e), "ts": datetime.now(timezone.utc).isoformat()})
            loop.call_soon_threadsafe(q.put_nowait, {"type": "done"})
    finally:
        _thread_local.queue = None
        _thread_local.job_id = None


@app.post("/api/process", summary="Upload an invoice for OCR + extraction")
async def process_invoice(
    file: UploadFile = File(...),
    _user: str = Depends(get_current_user),
) -> dict:
    suffix = Path(file.filename).suffix.lower()
    if suffix not in config.SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(config.SUPPORTED_EXTENSIONS))}",
        )

    config.INVOICES_DIR.mkdir(parents=True, exist_ok=True)
    dest = config.INVOICES_DIR / file.filename
    dest.write_bytes(await file.read())

    job_id = uuid.uuid4().hex
    _jobs[job_id] = {"status": "pending", "stem": dest.stem, "filename": file.filename, "result": None, "error": None}
    _streams[job_id] = asyncio.Queue()

    loop = asyncio.get_event_loop()
    loop.run_in_executor(_executor, _run_crew, job_id, dest)

    return {
        "job_id": job_id,
        "status": "pending",
        "filename": file.filename,
        "stream_url": f"/api/stream/{job_id}",
    }


@app.get("/api/stream/{job_id}", summary="SSE stream of agent execution events")
async def stream_job(
    job_id: str,
    _user: str = Depends(get_current_user),
):
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    queue = _streams.get(job_id)
    if queue is None:
        raise HTTPException(status_code=410, detail="Stream no longer available")

    async def _event_generator():
        try:
            while True:
                payload = await asyncio.wait_for(queue.get(), timeout=120.0)
                if payload.get("type") == "done":
                    yield {"data": json.dumps({"type": "done"})}
                    break
                yield {"data": json.dumps(payload)}
        except asyncio.TimeoutError:
            yield {"data": json.dumps({"type": "timeout", "message": "Processing timed out"})}
        finally:
            _streams.pop(job_id, None)

    return EventSourceResponse(_event_generator())


# ---------------------------------------------------------------------------
# Read endpoints
# ---------------------------------------------------------------------------

@app.get("/api/job/{job_id}", summary="Poll job status")
async def get_job(job_id: str, _user: str = Depends(get_current_user)) -> dict:
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return {"job_id": job_id, **job}


@app.get("/api/jobs", summary="List all in-memory jobs (this session)")
async def list_jobs(_user: str = Depends(get_current_user)) -> dict:
    return {"jobs": [
        {"job_id": jid, **{k: v for k, v in job.items() if k != "result"}}
        for jid, job in _jobs.items()
    ]}


@app.get("/api/invoices", summary="List all processed invoices")
async def list_invoices(_user: str = Depends(get_current_user)) -> dict:
    results = []
    for status, directory in [("pass", config.JSON_PASS_DIR), ("failed", config.JSON_FAIL_DIR)]:
        if directory.exists():
            for f in sorted(directory.glob("*.json")):
                results.append({"stem": f.stem, "status": status, "filename": f.name})
    return {"invoices": results, "total": len(results)}


@app.get("/api/invoice/{stem}", summary="Get extracted invoice JSON")
async def get_invoice(stem: str, _user: str = Depends(get_current_user)) -> dict:
    for directory in [config.JSON_PASS_DIR, config.JSON_FAIL_DIR]:
        path = directory / f"{stem}.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail=f"Invoice '{stem}' not found")


@app.get("/api/raw/{stem}", summary="Get raw OCR text for an invoice")
async def get_raw_text(stem: str, _user: str = Depends(get_current_user)) -> dict:
    path = config.RAW_DATA_DIR / f"{stem}.txt"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Raw OCR text for '{stem}' not found")
    return {"stem": stem, "text": path.read_text(encoding="utf-8")}


@app.get("/api/traces/{stem}", summary="Get per-invoice LLM trace JSON")
async def get_trace(stem: str, _user: str = Depends(get_current_user)) -> dict:
    path = config.TRACES_DIR / f"{stem}_trace.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Trace for '{stem}' not found")
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/api/logs", summary="Last N entries from llm_traces.jsonl")
async def get_logs(
    limit: int = Query(100, ge=1, le=1000),
    _user: str = Depends(get_current_user),
) -> dict:
    path = config.LOGS_DIR / "llm_traces.jsonl"
    if not path.exists():
        return {"entries": [], "total": 0}
    lines = [l.strip() for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    tail = lines[-limit:]
    entries = []
    for line in tail:
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    return {"entries": list(reversed(entries)), "total": len(lines)}


@app.get("/api/reference/{stem}", summary="List reference image filenames for a stem")
async def get_reference_files(stem: str, _user: str = Depends(get_current_user)) -> dict:
    if not config.REFERENCE_DIR.exists():
        return {"stem": stem, "images": []}
    images = sorted(
        p.name for p in config.REFERENCE_DIR.glob(f"{stem}_page*_ref.png")
    )
    return {"stem": stem, "images": images}


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "llm_provider": config.LLM_PROVIDER, "ocr_engine": config.OCR_ENGINE}


# ---------------------------------------------------------------------------
# Static files
# ---------------------------------------------------------------------------

if config.REFERENCE_DIR.exists():
    app.mount("/reference", StaticFiles(directory=str(config.REFERENCE_DIR)), name="reference")

# ---------------------------------------------------------------------------
# Run directly
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
