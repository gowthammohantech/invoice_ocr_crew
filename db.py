import json
import sqlite3
from datetime import datetime, timezone
import config

DB_PATH = config.BASE_DIR / "data" / "invoices.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db() -> None:
    with _conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS invoices (
                stem       TEXT PRIMARY KEY,
                filename   TEXT NOT NULL,
                status     TEXT NOT NULL,
                data       TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS bank_statements (
                stem       TEXT PRIMARY KEY,
                filename   TEXT NOT NULL,
                status     TEXT NOT NULL,
                data       TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        c.commit()


# Ensure the schema exists as soon as this module is imported
init_db()


def migrate_from_files() -> int:
    """Import JSON files that aren't yet in the DB. Returns count imported."""
    imported = 0
    for status, directory in [("pass", config.JSON_PASS_DIR), ("failed", config.JSON_FAIL_DIR)]:
        if not directory.exists():
            continue
        for f in sorted(directory.glob("*.json")):
            with _conn() as c:
                if c.execute("SELECT 1 FROM invoices WHERE stem = ?", (f.stem,)).fetchone():
                    continue
                try:
                    raw = f.read_text(encoding="utf-8")
                    # Try to find original invoice filename
                    filename = f"{f.stem}.pdf"
                    for ext in (".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp", ".heic", ".heif"):
                        candidate = config.INVOICES_DIR / f"{f.stem}{ext}"
                        if candidate.exists():
                            filename = candidate.name
                            break
                    c.execute(
                        "INSERT INTO invoices (stem, filename, status, data, created_at) VALUES (?, ?, ?, ?, ?)",
                        (f.stem, filename, status, raw, datetime.now(timezone.utc).isoformat()),
                    )
                    c.commit()
                    imported += 1
                except Exception:
                    pass
    return imported


def save_invoice(stem: str, filename: str, data: dict, status: str) -> None:
    with _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO invoices (stem, filename, status, data, created_at) VALUES (?, ?, ?, ?, ?)",
            (stem, filename, status, json.dumps(data, ensure_ascii=False), datetime.now(timezone.utc).isoformat()),
        )
        c.commit()


def list_invoices() -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT stem, filename, status, created_at FROM invoices ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def get_invoice(stem: str) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT data FROM invoices WHERE stem = ?", (stem,)).fetchone()
        return json.loads(row["data"]) if row else None


# ---------------------------------------------------------------------------
# Bank statement functions
# ---------------------------------------------------------------------------

def migrate_bank_from_files() -> int:
    """Import bank statement JSON files that aren't yet in the DB."""
    imported = 0
    for status, directory in [("pass", config.BANK_DATA_PASS_DIR), ("failed", config.BANK_DATA_FAIL_DIR)]:
        if not directory.exists():
            continue
        for f in sorted(directory.glob("*.json")):
            with _conn() as c:
                if c.execute("SELECT 1 FROM bank_statements WHERE stem = ?", (f.stem,)).fetchone():
                    continue
                try:
                    raw = f.read_text(encoding="utf-8")
                    filename = f"{f.stem}.pdf"
                    for ext in (".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp", ".heic", ".heif"):
                        candidate = config.BANK_STATEMENTS_DIR / f"{f.stem}{ext}"
                        if candidate.exists():
                            filename = candidate.name
                            break
                    c.execute(
                        "INSERT INTO bank_statements (stem, filename, status, data, created_at) VALUES (?, ?, ?, ?, ?)",
                        (f.stem, filename, status, raw, datetime.now(timezone.utc).isoformat()),
                    )
                    c.commit()
                    imported += 1
                except Exception:
                    pass
    return imported


def save_bank_statement(stem: str, filename: str, data: dict, status: str) -> None:
    with _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO bank_statements (stem, filename, status, data, created_at) VALUES (?, ?, ?, ?, ?)",
            (stem, filename, status, json.dumps(data, ensure_ascii=False), datetime.now(timezone.utc).isoformat()),
        )
        c.commit()


def list_bank_statements() -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT stem, filename, status, created_at FROM bank_statements ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def get_bank_statement(stem: str) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT data FROM bank_statements WHERE stem = ?", (stem,)).fetchone()
        return json.loads(row["data"]) if row else None
