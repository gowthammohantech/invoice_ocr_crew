import re
import pathlib

from crewai import Agent
import config

def _get_crew_llm() -> str:
    provider = config.LLM_PROVIDER
    if provider == "ollama":
        return f"ollama/{config.CREW_AGENT_MODEL}"
    elif provider == "ollama_cloud":
        model = config.CREW_AGENT_MODEL_CLOUD or config.OLLAMA_CLOUD_MODEL
        return f"openai/{model}"
    elif provider == "gemini":
        return f"gemini/{config.GEMINI_MODEL}"
    elif provider == "openai":
        return f"openai/{config.OPENAI_MODEL}"
    raise ValueError(f"Unknown LLM_PROVIDER: {provider!r}")

_LLM = _get_crew_llm()


def make_bank_ocr_agent() -> Agent:
    from bank_tools import BankOCRTool
    return Agent(
        role="OCR Specialist",
        goal=(
            "Extract all readable text from bank statement files with maximum accuracy. "
            "Use the OCR tool with the exact file path provided and return the complete raw text."
        ),
        backstory=(
            "You are a document digitization expert with deep experience handling "
            "diverse document formats — PDFs, scanned images, and photos. "
            "You invoke OCR tools precisely and verify that meaningful text was extracted."
        ),
        tools=[BankOCRTool()],
        llm=_LLM,
        verbose=True,
        allow_delegation=False,
    )


def make_bank_extraction_agent() -> Agent:
    from bank_tools import BankLLMExtractionTool
    return Agent(
        role="Bank Statement Extraction Expert",
        goal=(
            "Parse raw OCR text from bank statements and produce a complete, structured JSON "
            "containing account details, statement period, opening/closing balances, and every transaction. "
            "Every numeric field must be a float or null."
        ),
        backstory=(
            "You are a financial data specialist trained on thousands of bank statements from "
            "Indian and international banks. You understand account statement formats, "
            "transaction date fields, debit/credit columns, and running balance sequences. "
            "You extract structured data accurately even from imperfect OCR text."
        ),
        tools=[BankLLMExtractionTool()],
        llm=_LLM,
        verbose=True,
        allow_delegation=False,
    )


def make_bank_validation_agent() -> Agent:
    from bank_tools import BankValidatorTool
    return Agent(
        role="Bank Statement Validation Auditor",
        goal=(
            "Run all 5 reconciliation checks on extracted bank statement data. "
            "Do not modify the extracted values — only annotate them with a validation block."
        ),
        backstory=(
            "You are a forensic accountant who ensures bank statement data integrity. "
            "You verify that opening and closing balances match, totals reconcile with transaction sums, "
            "and the running balance column is internally consistent."
        ),
        tools=[BankValidatorTool()],
        llm=_LLM,
        verbose=True,
        allow_delegation=False,
    )


def make_bank_storage_agent() -> Agent:
    from bank_tools import BankStorageTool
    return Agent(
        role="Bank Statement Storage Manager",
        goal=(
            "Save the final validated bank statement JSON to the correct output directory. "
            "Pass-validated statements go to pass/, statements with failed checks go to failed/. "
            "Return the saved file path as confirmation."
        ),
        backstory=(
            "You are a meticulous data engineer maintaining the bank statement archive. "
            "You route every processed statement to the right directory based on validation results."
        ),
        tools=[BankStorageTool()],
        llm=_LLM,
        verbose=True,
        allow_delegation=False,
    )
