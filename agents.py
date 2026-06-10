import re
import pathlib

from crewai import Agent
import config

_LLM = config.get_litellm_model_string()
_SKILLS_PATH = pathlib.Path(__file__).parent / "skills.md"


def load_agent_skills(role: str) -> str:
    if not _SKILLS_PATH.exists():
        return ""
    text = _SKILLS_PATH.read_text()
    pattern = rf"##\s+{re.escape(role)}\s*\n(.*?)(?=\n##\s|\Z)"
    match = re.search(pattern, text, re.DOTALL)
    return match.group(1).strip() if match else ""


def _with_skills(backstory: str, role: str) -> str:
    skills = load_agent_skills(role)
    return f"{backstory}\n\nSkills:\n{skills}" if skills else backstory


def make_ocr_agent() -> Agent:
    from tools import OCRTool
    return Agent(
        role="OCR Specialist",
        goal=(
            "Extract all readable text from invoice files with maximum accuracy. "
            "Use the OCR tool with the exact file path provided and return the complete raw text."
        ),
        backstory=_with_skills(
            "You are a document digitization expert with deep experience handling "
            "diverse invoice formats — PDFs, scanned images, photos, and HEIC files. "
            "You invoke OCR tools precisely and verify that meaningful text was extracted.",
            "OCR Specialist",
        ),
        tools=[OCRTool()],
        llm=_LLM,
        verbose=True,
        allow_delegation=False,
    )


def make_extraction_agent() -> Agent:
    from tools import LLMExtractionTool
    return Agent(
        role="Invoice Data Extraction Expert",
        goal=(
            "Parse raw OCR text from invoices and produce a complete, structured JSON "
            "following the invoice schema exactly. Every numeric field must be a float or null. "
            "Line items must be fully populated with all available fields."
        ),
        backstory=_with_skills(
            "You are a financial data specialist trained on thousands of Indian and international "
            "invoices. You understand GSTIN formats, HSN/SAC codes, and GST tax components "
            "(CGST, SGST, IGST). You can extract structured data even from imperfect OCR text.",
            "Invoice Data Extraction Expert",
        ),
        tools=[LLMExtractionTool()],
        llm=_LLM,
        verbose=True,
        allow_delegation=False,
    )


def make_validation_agent() -> Agent:
    from tools import ValidatorTool
    return Agent(
        role="Invoice Validation Auditor",
        goal=(
            "Run all 5 mathematical reconciliation checks on extracted invoice data. "
            "Do not modify the extracted values — only annotate them with a validation block."
        ),
        backstory=_with_skills(
            "You are a forensic accountant who ensures invoice data integrity. You verify "
            "that line item amounts sum to subtotals, totals reconcile with taxes and discounts, "
            "and no page-level totals have been accidentally captured as line items.",
            "Invoice Validation Auditor",
        ),
        tools=[ValidatorTool()],
        llm=_LLM,
        verbose=True,
        allow_delegation=False,
    )


def make_storage_agent() -> Agent:
    from tools import StorageTool
    return Agent(
        role="Invoice Storage Manager",
        goal=(
            "Save the final validated invoice JSON to the correct output directory. "
            "Pass-validated invoices go to pass/, invoices with failed checks go to failed/. "
            "Return the saved file path as confirmation."
        ),
        backstory=_with_skills(
            "You are a meticulous data engineer maintaining the invoice archive. "
            "You route every processed invoice to the right directory based on validation results "
            "and confirm the save with the output file path.",
            "Invoice Storage Manager",
        ),
        tools=[StorageTool()],
        llm=_LLM,
        verbose=True,
        allow_delegation=False,
    )
