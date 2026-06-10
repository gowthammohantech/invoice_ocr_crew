export interface InvoiceSummary {
  stem: string;
  status: "pass" | "failed";
  filename: string;
}

export interface LineItem {
  description: string;
  hsn_sac_code?: string;
  quantity?: number;
  unit_price?: number;
  tax_rate?: number;
  amount?: number;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  detail?: Record<string, unknown>;
}

export interface ValidationResult {
  passed: boolean | null;
  failed_checks: string[];
  checks: ValidationCheck[];
}

export interface InvoiceDetail {
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  vendor_name?: string;
  vendor_gstin?: string;
  vendor_address?: string;
  customer_name?: string;
  customer_gstin?: string;
  po_number?: string;
  currency?: string;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  grand_total?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  bank_name?: string;
  account_number?: string;
  ifsc_swift?: string;
  payment_terms?: string;
  line_items: LineItem[];
  validation?: ValidationResult;
  confidence_score?: number;
}

export interface SSEEvent {
  type:
    | "crew_started"
    | "task_started"
    | "task_completed"
    | "task_failed"
    | "tool_started"
    | "tool_finished"
    | "crew_completed"
    | "crew_failed"
    | "done"
    | "timeout";
  ts?: string;
  agent_role?: string;
  description?: string;
  tool_name?: string;
  preview?: string;
  file_stem?: string;
  result_path?: string;
  error?: string;
  message?: string;
}

export interface Job {
  job_id: string;
  status: "pending" | "running" | "done" | "failed";
  stem: string;
  filename: string;
  result?: string;
  error?: string;
}

export interface TraceEntry {
  trace_id: string;
  timestamp: string;
  invoice_file: string;
  provider: string;
  model: string;
  duration_ms: number;
  status: "success" | "error";
  request?: unknown;
  response?: unknown;
  parsed_json?: unknown;
  error?: string;
}
