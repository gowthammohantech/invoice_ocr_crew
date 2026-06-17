"""
FastAPI server for the Invoice OCR CrewAI pipeline.

Auth:
  POST /auth/login          — exchange APP_ACCESS_TOKEN for a 24-hour JWT

Invoice processing (SSE):
  POST /api/process         — upload invoice → returns job_id + stream_url (JWT required)
  GET  /api/stream/{id}     — SSE stream of agent execution events (JWT via ?token=)

Read endpoints (public):
  GET  /api/invoices        — list all saved results from SQLite
  GET  /api/invoice/{stem}  — fetch extracted invoice JSON from SQLite
  GET  /api/raw/{stem}      — get raw OCR text
  GET  /api/reference/{stem}— list reference image filenames
  GET  /health              — health check

HTML pages (public):
  GET  /                    — invoice viewer
  GET  /live                — upload + live processing view
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import config
import db

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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
JWT_EXPIRE_SECONDS = 86400

STATIC_DIR = config.BASE_DIR / "static"

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
# Auth dependency (used only for write endpoints)
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    token: Optional[str] = Query(None, include_in_schema=False),
) -> str:
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
# CrewAI SSE event bridge
# ---------------------------------------------------------------------------

def _try_parse_json(text: str) -> dict | None:
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"\{[\s\S]+\}", text)
    if m:
        try:
            return json.loads(m.group())
        except Exception:
            pass
    return None


class _SSEEventBridge:
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
            bridge._emit({"type": "crew_started", "ts": datetime.now(timezone.utc).isoformat()})

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
            agent_role = _agent_role(task)

            # Emit extracted fields when the extraction task completes
            if "Extraction Expert" in agent_role and event.output:
                parsed = _try_parse_json(raw)
                if parsed:
                    bridge._emit({
                        "type": "fields_update",
                        "fields": parsed,
                        "ts": datetime.now(timezone.utc).isoformat(),
                    })

            bridge._emit({
                "type": "task_completed",
                "agent_role": agent_role,
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
            bridge._emit({
                "type": "crew_completed",
                "file_stem": stem,
                "ts": datetime.now(timezone.utc).isoformat(),
            })
            # Do NOT emit "done" here — _run_crew's finally block emits it after
            # db.migrate_from_files() so the frontend fetches AFTER the DB is populated.

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


_sse_bridge = _SSEEventBridge()


@app.on_event("startup")
async def _startup() -> None:
    global _main_loop
    _main_loop = asyncio.get_running_loop()
    _sse_bridge.register()

    # Ensure dirs exist
    config.INVOICES_DIR.mkdir(parents=True, exist_ok=True)
    config.REFERENCE_DIR.mkdir(parents=True, exist_ok=True)
    config.BANK_STATEMENTS_DIR.mkdir(parents=True, exist_ok=True)

    # Init SQLite and import any existing JSON files
    db.init_db()
    imported = db.migrate_from_files()
    if imported:
        print(f"[db] Migrated {imported} invoice(s) from JSON files into SQLite")
    bank_imported = db.migrate_bank_from_files()
    if bank_imported:
        print(f"[db] Migrated {bank_imported} bank statement(s) from JSON files into SQLite")


# ---------------------------------------------------------------------------
# HTML pages
# ---------------------------------------------------------------------------

@app.get("/", include_in_schema=False)
async def root():
    p = STATIC_DIR / "index.html"
    if not p.exists():
        return {"message": "Invoice OCR API — see /docs or /live"}
    return FileResponse(p)


@app.get("/live", include_in_schema=False)
async def live_page():
    p = STATIC_DIR / "live.html"
    if not p.exists():
        raise HTTPException(status_code=404, detail="live.html not found")
    return FileResponse(p)


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
# Processing endpoints (JWT required)
# ---------------------------------------------------------------------------

def _run_bank_crew(job_id: str, file_path: Path) -> None:
    _thread_local.job_id = job_id
    _thread_local.queue = _streams.get(job_id)

    _jobs[job_id]["status"] = "running"
    _crew_result: str | None = None
    try:
        from bank_crew import BankReconciliationCrew
        result = BankReconciliationCrew().crew().kickoff(inputs={
            "file_path": str(file_path.resolve()),
            "file_stem": file_path.stem,
        })
        validated_json = result.raw if hasattr(result, "raw") else str(result)
        from bank_tools.bank_storage_tool import BankStorageTool as _BankStorageTool
        storage_result = _BankStorageTool()._run(statement_json=validated_json, stem=file_path.stem)
        print(f"[server] Bank storage: {storage_result}", flush=True)
        _crew_result = storage_result
    except Exception as e:
        _jobs[job_id].update({"status": "failed", "error": str(e)})
        q = _streams.get(job_id)
        loop = _main_loop
        if q and loop:
            loop.call_soon_threadsafe(q.put_nowait, {"type": "crew_failed", "error": str(e), "ts": datetime.now(timezone.utc).isoformat()})
            loop.call_soon_threadsafe(q.put_nowait, {"type": "done"})
    finally:
        db.migrate_bank_from_files()
        if _crew_result is not None:
            _jobs[job_id].update({"status": "done", "result": _crew_result})
            q = _streams.get(job_id)
            loop = _main_loop
            if q and loop:
                loop.call_soon_threadsafe(q.put_nowait, {"type": "done"})
        _thread_local.queue = None
        _thread_local.job_id = None


def _run_crew(job_id: str, file_path: Path) -> None:
    _thread_local.job_id = job_id
    _thread_local.queue = _streams.get(job_id)

    _jobs[job_id]["status"] = "running"
    _crew_result: str | None = None
    try:
        from crew import InvoiceOCRCrew
        result = InvoiceOCRCrew().crew().kickoff(inputs={
            "file_path": str(file_path.resolve()),
            "file_stem": file_path.stem,
        })
        # Crew returns the validated JSON from the validation task.
        # Call StorageTool directly — never delegate file I/O to an LLM agent.
        validated_json = result.raw if hasattr(result, "raw") else str(result)
        from tools.storage_tool import StorageTool as _StorageTool
        storage_result = _StorageTool()._run(invoice_json=validated_json, stem=file_path.stem)
        print(f"[server] Storage: {storage_result}", flush=True)
        _crew_result = storage_result
    except Exception as e:
        _jobs[job_id].update({"status": "failed", "error": str(e)})
        q = _streams.get(job_id)
        loop = _main_loop
        if q and loop:
            loop.call_soon_threadsafe(q.put_nowait, {"type": "crew_failed", "error": str(e), "ts": datetime.now(timezone.utc).isoformat()})
            loop.call_soon_threadsafe(q.put_nowait, {"type": "done"})
    finally:
        # Import JSON files the storage tool wrote to disk — primary safety net when the
        # in-process DB save fails. Must complete BEFORE emitting "done" so the frontend
        # fetches find the data already in SQLite.
        db.migrate_from_files()
        if _crew_result is not None:
            _jobs[job_id].update({"status": "done", "result": _crew_result})
            q = _streams.get(job_id)
            loop = _main_loop
            if q and loop:
                loop.call_soon_threadsafe(q.put_nowait, {"type": "done"})
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
    # Store file_path so the SSE endpoint can start the crew after connecting
    _jobs[job_id] = {
        "status": "pending",
        "stem": dest.stem,
        "filename": file.filename,
        "file_path": str(dest),
        "result": None,
        "error": None,
    }
    _streams[job_id] = asyncio.Queue()

    # Do NOT start the crew here — start it only when the SSE client connects.
    # This eliminates the race where events queue up before the browser is listening.

    return {
        "job_id": job_id,
        "status": "pending",
        "filename": file.filename,
        "stem": dest.stem,
        "stream_url": f"/api/stream/{job_id}",
    }


@app.get("/api/stream/{job_id}", summary="SSE stream of agent execution events")
async def stream_job(
    job_id: str,
    _user: str = Depends(get_current_user),
):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    queue = _streams.get(job_id)
    if queue is None:
        raise HTTPException(status_code=410, detail="Stream no longer available")

    # Start the crew NOW — the SSE connection is open, so no events will be missed
    if job.get("status") == "pending":
        file_path = Path(job["file_path"])
        loop = asyncio.get_event_loop()
        crew_fn = _run_bank_crew if job.get("type") == "bank" else _run_crew
        loop.run_in_executor(_executor, crew_fn, job_id, file_path)

    async def _event_generator():
        _iters = 0
        _max_iters = 600  # 2 s × 600 = 20 min ceiling
        try:
            while _iters < _max_iters:
                _iters += 1
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=2.0)
                except asyncio.TimeoutError:
                    job = _jobs.get(job_id, {})
                    status = job.get("status", "pending")
                    if status == "done":
                        stem = job.get("stem", "")
                        yield {"data": json.dumps({"type": "crew_completed", "file_stem": stem, "ts": datetime.now(timezone.utc).isoformat()})}
                        yield {"data": json.dumps({"type": "done"})}
                        break
                    elif status == "failed":
                        yield {"data": json.dumps({"type": "crew_failed", "error": job.get("error", "Unknown error"), "ts": datetime.now(timezone.utc).isoformat()})}
                        yield {"data": json.dumps({"type": "done"})}
                        break
                    # Still running — send a heartbeat comment to keep the connection alive
                    yield {"comment": "heartbeat"}
                    continue
                if payload.get("type") == "done":
                    yield {"data": json.dumps({"type": "done"})}
                    break
                yield {"data": json.dumps(payload)}
            else:
                yield {"data": json.dumps({"type": "timeout", "message": "Processing timed out"})}
        finally:
            _streams.pop(job_id, None)

    return EventSourceResponse(_event_generator())


# ---------------------------------------------------------------------------
# Read endpoints (public — no JWT required)
# ---------------------------------------------------------------------------

@app.get("/api/invoices", summary="List all processed invoices")
async def list_invoices() -> dict:
    results = db.list_invoices()
    return {"invoices": results, "total": len(results)}


@app.get("/api/invoice/{stem}/meta", summary="Get invoice metadata (filename, status, created_at)")
async def get_invoice_meta(stem: str) -> dict:
    rows = db.list_invoices()
    meta = next((r for r in rows if r["stem"] == stem), None)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Invoice '{stem}' not found")
    return meta


@app.get("/api/invoice/{stem}", summary="Get extracted invoice JSON")
async def get_invoice(stem: str) -> dict:
    data = db.get_invoice(stem)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Invoice '{stem}' not found")
    return data


@app.get("/api/raw/{stem}", summary="Get raw OCR text for an invoice")
async def get_raw_text(stem: str) -> dict:
    path = config.RAW_DATA_DIR / f"{stem}.txt"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Raw OCR text for '{stem}' not found")
    return {"stem": stem, "text": path.read_text(encoding="utf-8")}


@app.get("/api/reference/{stem}", summary="List reference image filenames for a stem")
async def get_reference_files(stem: str) -> dict:
    if not config.REFERENCE_DIR.exists():
        return {"stem": stem, "images": []}
    images = sorted(p.name for p in config.REFERENCE_DIR.glob(f"{stem}_page*_ref.png"))
    return {"stem": stem, "images": images}


@app.get("/api/job/{job_id}", summary="Poll job status")
async def get_job(job_id: str, _user: str = Depends(get_current_user)) -> dict:
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return {"job_id": job_id, **job}


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "llm_provider": config.LLM_PROVIDER, "ocr_engine": config.OCR_ENGINE}


# ---------------------------------------------------------------------------
# Bank reconciliation endpoints
# ---------------------------------------------------------------------------

@app.post("/api/bank/process", summary="Upload a bank statement for OCR + extraction")
async def process_bank_statement(
    file: UploadFile = File(...),
    _user: str = Depends(get_current_user),
) -> dict:
    suffix = Path(file.filename).suffix.lower()
    if suffix not in config.SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(config.SUPPORTED_EXTENSIONS))}",
        )

    config.BANK_STATEMENTS_DIR.mkdir(parents=True, exist_ok=True)
    dest = config.BANK_STATEMENTS_DIR / file.filename
    dest.write_bytes(await file.read())

    job_id = uuid.uuid4().hex
    _jobs[job_id] = {
        "status": "pending",
        "type": "bank",
        "stem": dest.stem,
        "filename": file.filename,
        "file_path": str(dest),
        "result": None,
        "error": None,
    }
    _streams[job_id] = asyncio.Queue()

    return {
        "job_id": job_id,
        "status": "pending",
        "filename": file.filename,
        "stem": dest.stem,
        "stream_url": f"/api/stream/{job_id}",
    }


@app.get("/api/bank/statements", summary="List all processed bank statements")
async def list_bank_statements() -> dict:
    results = db.list_bank_statements()
    return {"statements": results, "total": len(results)}


@app.get("/api/bank/statement/{stem}/meta", summary="Get bank statement metadata")
async def get_bank_statement_meta(stem: str) -> dict:
    rows = db.list_bank_statements()
    meta = next((r for r in rows if r["stem"] == stem), None)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Bank statement '{stem}' not found")
    return meta


@app.get("/api/bank/statement/{stem}", summary="Get extracted bank statement JSON")
async def get_bank_statement(stem: str) -> dict:
    data = db.get_bank_statement(stem)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Bank statement '{stem}' not found")
    return data


@app.get("/api/bank/raw/{stem}", summary="Get raw OCR text for a bank statement")
async def get_bank_raw_text(stem: str) -> dict:
    path = config.BANK_RAW_DATA_DIR / f"{stem}.txt"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Raw OCR text for '{stem}' not found")
    return {"stem": stem, "text": path.read_text(encoding="utf-8")}


# ---------------------------------------------------------------------------
# Static file mounts (after all routes)
# Directories must exist before StaticFiles is instantiated.
# ---------------------------------------------------------------------------

config.INVOICES_DIR.mkdir(parents=True, exist_ok=True)
config.REFERENCE_DIR.mkdir(parents=True, exist_ok=True)
config.BANK_STATEMENTS_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/invoices", StaticFiles(directory=str(config.INVOICES_DIR)), name="invoices")
app.mount("/reference", StaticFiles(directory=str(config.REFERENCE_DIR)), name="reference")
app.mount("/bank-files", StaticFiles(directory=str(config.BANK_STATEMENTS_DIR)), name="bank_statements")

# ---------------------------------------------------------------------------
# Run directly
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8080, reload=False)
