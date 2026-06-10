# Elixir Global Innovation — Invoice OCR Agent Sandbox

An AI-powered invoice processing pipeline built with **CrewAI**, featuring a full-stack web interface for real-time agent execution monitoring.

---

## Overview

The system processes invoice files (PDF, PNG, HEIC, etc.) through a 4-agent CrewAI pipeline that extracts, validates, and stores structured invoice data. The web app provides a live view of each agent's execution as it runs.

```
Invoice File
    │
    ▼
┌─────────────────┐
│   OCR Agent     │  Extracts raw text via PaddleOCR or Tesseract
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Extraction Agent│  Parses OCR text → structured JSON (LLM-powered)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Validation Agent │  Runs 5 mathematical reconciliation checks
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Storage Agent  │  Routes to invoice_data/pass/ or invoice_data/failed/
└─────────────────┘
```

---

## Project Structure

```
invoice_ocr_crew/
├── server.py              # FastAPI backend (auth + SSE streaming + REST API)
├── crew.py                # CrewAI crew definition
├── agents.py              # Agent factory (OCR, Extraction, Validation, Storage)
├── tasks.py               # Task definitions
├── config.py              # Environment config
├── schemas.py             # Pydantic models
├── main.py                # CLI batch processor
├── _core/
│   ├── ocr_processor.py   # PaddleOCR / Tesseract integration
│   ├── llm_processor.py   # LLM calls (Ollama / Gemini / OpenAI)
│   ├── validator.py       # 5-check invoice reconciliation
│   └── trace_logger.py    # Structured LLM trace logging
├── tools/                 # CrewAI tools wrapping _core modules
├── invoices/              # Drop invoice files here (input)
├── invoice_data/
│   ├── pass/              # Validated invoices (JSON)
│   └── failed/            # Failed-validation invoices (JSON)
├── invoice_raw_data/      # Raw OCR text cache
├── invoice_traces/        # Per-invoice LLM trace JSON
├── logs/                  # Aggregate JSONL + human-readable logs
├── reference/             # OCR bounding-box overlay images
├── elixir-logo.png        # Brand logo
├── requirements.txt
├── .env.example
└── frontend/              # Next.js 14 web app
    └── src/
        ├── app/           # Pages: login, dashboard, process, invoices, logs
        ├── components/    # Sidebar, AuthGuard, DropZone, ExecutionTimeline, ...
        ├── hooks/         # useSSE, useInvoices
        └── lib/           # api.ts, auth.ts, types.ts
```

---

## Prerequisites

| Dependency | Notes |
|---|---|
| Python 3.10+ | Backend |
| Node.js 18+ | Frontend |
| [Ollama](https://ollama.ai) | Default local LLM (or use Gemini / OpenAI) |
| Poppler | PDF → image conversion: `brew install poppler` |
| Tesseract *(optional)* | Alternative OCR: `brew install tesseract` |

---

## Setup

### 1. Clone and configure environment

```bash
cp .env.example .env
# Edit .env with your settings
```

Key variables in `.env`:

```env
# LLM provider
LLM_PROVIDER=ollama          # ollama | gemini | openai
OLLAMA_MODEL=gemma4:31b-cloud

# Web app auth
APP_ACCESS_TOKEN=elixir-sandbox-2024   # shared login token for the web UI
JWT_SECRET=your-random-32-char-secret  # signs the 24h session JWTs
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

---

## Running

### Backend API

```bash
# From invoice_ocr_crew/
uvicorn server:app --reload --port 8000
```

The API runs at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
# From invoice_ocr_crew/frontend/
npm run dev
```

The web app runs at `http://localhost:3000`.

---

## Web App

### Login

Navigate to `http://localhost:3000` and enter the `APP_ACCESS_TOKEN` from your `.env`. The session persists for 24 hours via a signed JWT stored in the browser.

### Pages

| Page | Path | Description |
|---|---|---|
| Dashboard | `/dashboard` | Stats overview + agent pipeline diagram |
| Process | `/process` | Upload invoice + watch agents run live |
| Invoices | `/invoices` | Table of all processed invoices |
| Invoice Detail | `/invoices/[stem]` | OCR text, extracted JSON, validation checks, reference images |
| Agent Logs | `/logs` | LLM trace log viewer |

### Live Agent Execution

Upload an invoice on the **Process** page and watch the 4 agents execute in a real-time timeline. Each agent card shows:
- Current tool being called
- Status (running → complete / failed)
- Output preview on completion

---

## CLI Batch Processing

Process all files in `invoices/` without the web UI:

```bash
python main.py
```

Skips already-processed files. Prints a summary at the end.

---

## API Reference

All endpoints (except `/auth/login` and `/health`) require `Authorization: Bearer <jwt>`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Exchange `APP_ACCESS_TOKEN` → 24h JWT |
| `GET` | `/health` | Health check (public) |
| `POST` | `/api/process` | Upload invoice → returns `job_id` + `stream_url` |
| `GET` | `/api/stream/{job_id}` | SSE stream of agent execution events |
| `GET` | `/api/job/{job_id}` | Poll job status |
| `GET` | `/api/invoices` | List all processed invoices |
| `GET` | `/api/invoice/{stem}` | Get extracted invoice JSON |
| `GET` | `/api/raw/{stem}` | Get raw OCR text |
| `GET` | `/api/traces/{stem}` | Get per-invoice LLM trace |
| `GET` | `/api/logs` | Last 100 LLM trace entries |
| `GET` | `/api/reference/{stem}` | List reference image filenames |

---

## LLM Configuration

| Provider | Config |
|---|---|
| **Ollama** (default) | `LLM_PROVIDER=ollama`, `OLLAMA_MODEL=gemma4:31b-cloud` |
| **Gemini** | `LLM_PROVIDER=gemini`, `GEMINI_API_KEY=...`, `GEMINI_MODEL=gemini-1.5-flash` |
| **OpenAI** | `LLM_PROVIDER=openai`, `OPENAI_API_KEY=...`, `OPENAI_MODEL=gpt-4o-mini` |

---

## Validation Checks

The Validation Agent runs 5 checks on every extracted invoice:

1. **Line items sum** — `Σ line_item.amount ≈ subtotal`
2. **Totals reconciliation** — `subtotal + tax − discount ≈ grand_total`
3. **Quantity × price** — `qty × unit_price ≈ amount` per line item
4. **Currency format** — must be a valid 3-letter ISO code (INR, USD, EUR…)
5. **No page totals in line items** — detects if grand_total was captured as a line item

Tolerance: ±₹0.05 absolute or ±1% relative (handles rounding differences).

---

## Tech Stack

**Backend**: Python · FastAPI · CrewAI 1.14.6 · PaddleOCR · python-jose · sse-starlette

**Frontend**: Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · SWR · axios
