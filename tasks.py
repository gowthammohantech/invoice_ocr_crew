from crewai import Agent, Task


def make_ocr_task(agent: Agent) -> Task:
    return Task(
        description=(
            "Extract all text from the invoice file at this exact path: {file_path}\n\n"
            "Call the invoice_ocr_extractor tool with file_path='{file_path}'. "
            "Return the complete raw OCR text exactly as the tool produces it. "
            "If the tool returns a message starting with 'ERROR:', report it verbatim."
        ),
        expected_output=(
            "The complete raw text extracted from the invoice by OCR. "
            "Multi-page PDFs will have '--- PAGE N ---' section markers. "
            "If OCR failed, an error message starting with 'ERROR:'."
        ),
        agent=agent,
    )


def make_extraction_task(agent: Agent, ocr_task: Task) -> Task:
    return Task(
        description=(
            "The previous task extracted raw OCR text from an invoice. "
            "Your job: call the invoice_llm_extractor tool to parse it into structured JSON.\n\n"
            "Pass the full OCR text (from context) as 'ocr_text' and '{file_stem}' as 'filename'. "
            "Return the raw JSON string exactly as the tool returns it — "
            "no markdown, no explanation, no wrapping."
        ),
        expected_output=(
            "A valid JSON string containing all extracted invoice fields. "
            "Numeric fields are floats or null. Line items are an array of objects. "
            "No markdown code fences — raw JSON only."
        ),
        agent=agent,
        context=[ocr_task],
    )


def make_validation_task(agent: Agent, extraction_task: Task) -> Task:
    return Task(
        description=(
            "The previous task produced a structured invoice JSON string. "
            "Your job: call the invoice_validator tool to run all 5 reconciliation checks.\n\n"
            "Pass the JSON string (from context) as 'invoice_json'. "
            "Return the complete JSON string exactly as the tool returns it — "
            "it will include a 'validation' block with check details."
        ),
        expected_output=(
            "The invoice JSON string with a 'validation' key added at the top level. "
            "The validation block contains 'passed' (bool or null), "
            "'failed_checks' (list of check names), and 'checks' (list of detail objects). "
            "Return raw JSON only — no markdown, no explanation."
        ),
        agent=agent,
        context=[extraction_task],
    )


def make_storage_task(agent: Agent, validation_task: Task) -> Task:
    return Task(
        description=(
            "The previous task produced a validated invoice JSON string. "
            "Your job: call the invoice_storage tool to save it to disk.\n\n"
            "Pass the validated JSON string (from context) as 'invoice_json' "
            "and '{file_stem}' as 'stem'. "
            "Return the file path string that the tool returns."
        ),
        expected_output=(
            "The absolute path to the saved JSON file, e.g. "
            "'/path/to/invoice_data/pass/039.json'"
        ),
        agent=agent,
        context=[validation_task],
    )
