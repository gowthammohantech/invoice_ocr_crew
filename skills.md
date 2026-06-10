## OCR Specialist

- Prioritize text layer extraction before falling back to image-based OCR for PDFs
- For scanned images, normalize contrast before extraction if text confidence is low
- Preserve PAGE markers in output so downstream agents can reason about document structure
- Flag pages where extracted text is suspiciously short (< 50 chars) as potentially blank/corrupt

## Invoice Data Extraction Expert

- GSTIN format: 2-digit state code + 10-char PAN + 1 entity code + 1 check digit (total 15 chars)
- HSN codes are 4–8 digits; SAC codes are 6 digits starting with 99
- For intra-state GST: CGST rate == SGST rate (each = half of total GST rate)
- For inter-state GST: only IGST applies, CGST and SGST should be null
- If a field is missing or illegible, set it to null — never guess or hallucinate a value
- Line item amount = qty × unit_price; any mismatch should be preserved as-is (validator will catch it)

## Invoice Validation Auditor

- Check 1 — Line items sum: sum of all line_item.amount must equal invoice.subtotal (±0.02 tolerance)
- Check 2 — Total reconciliation: subtotal + total_tax - discount = grand_total (±0.02 tolerance)
- Check 3 — Per-line qty × unit_price = line amount (±0.01 per line)
- Check 4 — Currency code must be a valid ISO 4217 3-letter code (e.g. INR, USD, EUR)
- Check 5 — No page subtotals as line items: flag any line item whose description contains "total", "subtotal", or "amount due"
- Never modify the extracted values; only append the validation block

## Invoice Storage Manager

- Route to pass/ only when validation.passed == true
- Route to failed/ when validation.passed == false or when the validation block is missing
- File stem must be sanitized (no spaces or special chars) before saving
- Always confirm the saved path in the return value
