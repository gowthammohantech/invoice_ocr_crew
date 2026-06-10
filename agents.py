from crewai import Agent
import config

_LLM = config.get_litellm_model_string()


def make_ocr_agent() -> Agent:
    from tools import OCRTool
    return Agent(
        role="OCR Specialist",
        goal=(
            "Extract all readable text from invoice files with maximum accuracy. "
            "Use the OCR tool with the exact file path provided and return the complete raw text."
        ),
        backstory=(
            "You are a document digitization expert with deep experience handling "
            "diverse invoice formats — PDFs, scanned images, photos, and HEIC files. "
            "You invoke OCR tools precisely and verify that meaningful text was extracted."
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
        backstory=(
            "You are a financial data specialist trained on thousands of Indian and international "
            "invoices. You understand GSTIN formats, HSN/SAC codes, and GST tax components "
            "(CGST, SGST, IGST). You can extract structured data even from imperfect OCR text."
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
        backstory=(
            "You are a forensic accountant who ensures invoice data integrity. You verify "
            "that line item amounts sum to subtotals, totals reconcile with taxes and discounts, "
            "and no page-level totals have been accidentally captured as line items."
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
        backstory=(
            "You are a meticulous data engineer maintaining the invoice archive. "
            "You route every processed invoice to the right directory based on validation results "
            "and confirm the save with the output file path."
        ),
        tools=[StorageTool()],
        llm=_LLM,
        verbose=True,
        allow_delegation=False,
    )
