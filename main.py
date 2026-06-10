#!/usr/bin/env python3
"""
Batch invoice OCR processor using CrewAI.
Scans the invoices/ directory and runs one InvoiceOCRCrew per unprocessed file.

Usage:
    python main.py
    LLM_PROVIDER=gemini GEMINI_API_KEY=xxx python main.py
    LLM_PROVIDER=openai OPENAI_API_KEY=xxx python main.py
    OCR_ENGINE=tesseract python main.py
"""
import sys
from pathlib import Path

import config
from crew import InvoiceOCRCrew


def is_already_processed(file_path: Path) -> bool:
    stem = file_path.stem
    return (
        (config.JSON_PASS_DIR / f"{stem}.json").exists() or
        (config.JSON_FAIL_DIR / f"{stem}.json").exists()
    )


def process_invoice(file_path: Path) -> bool:
    print(f"\n{'='*60}")
    print(f"Processing: {file_path.name}")
    print(f"{'='*60}")

    inputs = {
        "file_path": str(file_path.resolve()),
        "file_stem": file_path.stem,
    }

    try:
        result = InvoiceOCRCrew().crew().kickoff(inputs=inputs)
        print(f"\nCrew finished. Result: {result}")
        return True
    except Exception as e:
        print(f"ERROR processing '{file_path.name}': {e}", file=sys.stderr)
        return False


def main() -> None:
    # Ensure all output directories exist
    for d in [
        config.INVOICES_DIR, config.RAW_DATA_DIR,
        config.JSON_PASS_DIR, config.JSON_FAIL_DIR,
        config.TRACES_DIR, config.LOGS_DIR, config.REFERENCE_DIR,
    ]:
        d.mkdir(parents=True, exist_ok=True)

    # Discover invoice files
    invoice_files = sorted(
        p for p in config.INVOICES_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in config.SUPPORTED_EXTENSIONS
    )

    if not invoice_files:
        print(f"No invoice files found in: {config.INVOICES_DIR.absolute()}")
        print(f"Supported formats: {', '.join(sorted(config.SUPPORTED_EXTENSIONS))}")
        return

    print(f"Found {len(invoice_files)} invoice file(s).")
    print(f"LLM provider : {config.LLM_PROVIDER}")
    print(f"OCR engine   : {config.OCR_ENGINE}")

    success, skipped, failed = 0, 0, 0

    for file_path in invoice_files:
        if is_already_processed(file_path):
            print(f"Skipping '{file_path.name}': already processed.")
            skipped += 1
            continue

        if process_invoice(file_path):
            success += 1
        else:
            failed += 1

    print(f"\n{'='*60}")
    print(f"Batch complete — Processed: {success}  Skipped: {skipped}  Failed: {failed}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
