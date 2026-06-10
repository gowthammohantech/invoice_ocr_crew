"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvoiceDetail, useInvoiceMeta, useReferenceImages } from "@/hooks/useInvoices";
import { InvoiceDetail, LineItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Field row ──────────────────────────────────────────────────────────────

function FieldRow({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  const empty = value == null || value === "";
  return (
    <div className="grid grid-cols-[120px_1fr] gap-x-2 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-400 font-medium pt-px">{label}</span>
      <span className={cn(
        "text-xs break-words",
        empty ? "text-slate-300 italic" : mono ? "font-mono text-sky-700" : "text-slate-700"
      )}>
        {empty ? "—" : String(value)}
      </span>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────

function Section({ title }: { title: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 mt-4 mb-1 first:mt-0">
      {title}
    </p>
  );
}

// ── Extracted data panel ──────────────────────────────────────────────────

function DataPanel({ invoice }: { invoice: InvoiceDetail }) {
  return (
    <div className="px-4 py-3">
      <Section title="Invoice Details" />
      <FieldRow label="Invoice #"     value={invoice.invoice_number} />
      <FieldRow label="Date"          value={invoice.invoice_date} />
      <FieldRow label="Due Date"      value={invoice.due_date} />
      <FieldRow label="PO Number"     value={invoice.po_number} />
      <FieldRow label="Currency"      value={invoice.currency} />
      <FieldRow label="Payment Terms" value={invoice.payment_terms} />

      <Section title="Vendor" />
      <FieldRow label="Name"    value={invoice.vendor_name} />
      <FieldRow label="GSTIN"   value={invoice.vendor_gstin} />
      <FieldRow label="Address" value={invoice.vendor_address} />

      <Section title="Customer" />
      <FieldRow label="Name"  value={invoice.customer_name} />
      <FieldRow label="GSTIN" value={invoice.customer_gstin} />

      <Section title="Amounts" />
      <FieldRow label="Subtotal"    value={fmt(invoice.subtotal)}        mono />
      <FieldRow label="Discount"    value={fmt(invoice.discount_amount)} mono />
      <FieldRow label="Tax Total"   value={fmt(invoice.tax_amount)}      mono />
      <FieldRow label="CGST"        value={fmt(invoice.cgst_amount)}     mono />
      <FieldRow label="SGST"        value={fmt(invoice.sgst_amount)}     mono />
      <FieldRow label="IGST"        value={fmt(invoice.igst_amount)}     mono />
      <FieldRow label="Grand Total" value={fmt(invoice.grand_total)}     mono />

      <Section title="Bank" />
      <FieldRow label="Bank Name"   value={invoice.bank_name} />
      <FieldRow label="Account #"   value={invoice.account_number} />
      <FieldRow label="IFSC / SWIFT" value={invoice.ifsc_swift} />

      {invoice.line_items?.length > 0 && (
        <>
          <Section title="Line Items" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-1.5 pr-2 text-slate-400 font-medium">Description</th>
                  <th className="text-left py-1.5 pr-2 text-slate-400 font-medium">HSN</th>
                  <th className="text-right py-1.5 pr-2 text-slate-400 font-medium">Qty</th>
                  <th className="text-right py-1.5 pr-2 text-slate-400 font-medium">Unit Price</th>
                  <th className="text-right py-1.5 text-slate-400 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items.map((item: LineItem, i: number) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-2 text-slate-700">{item.description || "—"}</td>
                    <td className="py-1.5 pr-2 text-slate-500">{item.hsn_sac_code || "—"}</td>
                    <td className="py-1.5 pr-2 text-right text-slate-500 font-mono">{item.quantity ?? "—"}</td>
                    <td className="py-1.5 pr-2 text-right text-sky-700 font-mono">{fmt(item.unit_price)}</td>
                    <td className="py-1.5 text-right text-sky-700 font-mono">{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Reference + Validation panel ──────────────────────────────────────────

function RefValidationPanel({ stem, invoice }: { stem: string; invoice: InvoiceDetail }) {
  const { images } = useReferenceImages(stem);
  const validation  = invoice.validation;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Reference images */}
      <div className="flex-1 overflow-auto min-h-0 border-b border-slate-100">
        <div className="px-3 py-2">
          {images.length === 0 ? (
            <p className="text-xs text-slate-300 py-4 text-center">No reference image</p>
          ) : (
            images.map((img) => (
              <div key={img} className="mb-3 last:mb-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API_BASE}/reference/${img}`}
                  alt={img}
                  className="w-full rounded-lg border border-slate-200 object-contain"
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Validation checks */}
      {validation && (
        <div className="flex-shrink-0 px-3 py-3 overflow-auto" style={{ maxHeight: "45%" }}>
          {/* Overall result badge */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-xs font-semibold",
            validation.passed === true  ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
            validation.passed === false ? "bg-red-50 text-red-700 border border-red-200" :
            "bg-slate-50 text-slate-500 border border-slate-200"
          )}>
            {validation.passed === true  && <CheckCircle  className="w-3.5 h-3.5 flex-shrink-0" />}
            {validation.passed === false && <XCircle      className="w-3.5 h-3.5 flex-shrink-0" />}
            {validation.passed == null   && <AlertCircle  className="w-3.5 h-3.5 flex-shrink-0" />}
            {validation.passed === true  ? "All checks passed" :
             validation.passed === false ? "Validation failed" : "Inconclusive"}
          </div>

          {/* Per-check rows */}
          <div className="space-y-1">
            {(validation.checks as unknown as Record<string, unknown>[]).map((check, i) => {
              const passed  = check.passed as boolean;
              const name    = (check.name as string) || `Check ${i + 1}`;
              const delta   = check.delta as number | undefined;
              const expected = check.expected as number | undefined;
              const computed = check.computed as number | undefined;
              return (
                <div key={i} className={cn(
                  "flex items-start gap-2 px-2 py-1.5 rounded-md text-xs",
                  passed ? "bg-emerald-50" : "bg-red-50"
                )}>
                  {passed
                    ? <CheckCircle className="w-3 h-3 text-emerald-500 mt-px flex-shrink-0" />
                    : <XCircle    className="w-3 h-3 text-red-500 mt-px flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className={cn("font-medium truncate", passed ? "text-emerald-700" : "text-red-700")}>{name}</p>
                    {delta != null && (
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        expected {fmt(expected)} · got {fmt(computed)} · Δ{fmt(delta)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function InvoiceDetailPage() {
  const { stem } = useParams<{ stem: string }>();
  const { invoice, isLoading }  = useInvoiceDetail(stem);
  const { meta }                = useInvoiceMeta(stem);

  const passed     = invoice?.validation?.passed;
  const filename   = meta?.filename;
  const pdfUrl     = filename ? `${API_BASE}/invoices/${filename}` : null;
  const confidence = invoice?.confidence_score;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
      {/* Page header */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-200 bg-white flex-shrink-0">
        <Link
          href="/invoices"
          className="flex items-center gap-1 text-slate-400 hover:text-slate-700 text-xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>
        <span className="text-slate-300">|</span>
        <h1 className="text-sm font-semibold text-slate-800 font-mono">{stem}</h1>
        {isLoading ? (
          <Skeleton className="h-5 w-14" />
        ) : invoice ? (
          <Badge
            variant="outline"
            className={cn(
              "text-xs gap-1 py-0",
              passed === true  ? "border-emerald-200 text-emerald-700 bg-emerald-50" :
              passed === false ? "border-red-200 text-red-700 bg-red-50" :
              "border-slate-200 text-slate-500 bg-slate-50"
            )}
          >
            {passed === true  && <CheckCircle className="w-2.5 h-2.5" />}
            {passed === false && <XCircle     className="w-2.5 h-2.5" />}
            {passed === true ? "passed" : passed === false ? "failed" : "unknown"}
          </Badge>
        ) : null}
        {confidence != null && (
          <span className="text-xs text-slate-400 ml-1">
            {(confidence * 100).toFixed(0)}% confidence
          </span>
        )}
        {invoice?.vendor_name && (
          <span className="text-xs text-slate-400 ml-auto">{invoice.vendor_name}</span>
        )}
      </div>

      {/* 3-column body */}
      <div
        className="flex-1 grid overflow-hidden min-h-0"
        style={{ gridTemplateColumns: "1fr 340px 300px" }}
      >
        {/* ── Col 1: Invoice PDF ── */}
        <div className="flex flex-col overflow-hidden border-r border-slate-200">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 bg-slate-50 flex-shrink-0">
            Invoice
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Skeleton className="w-full h-full" />
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title="Invoice document"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-300">
                <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="text-xs">No file available</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Col 2: Extracted Data ── */}
        <div className="flex flex-col overflow-hidden border-r border-slate-200">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 bg-slate-50 flex-shrink-0">
            Extracted Data
          </div>
          <div className="flex-1 overflow-auto min-h-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-4" />)}
              </div>
            ) : invoice ? (
              <DataPanel invoice={invoice} />
            ) : (
              <p className="p-4 text-xs text-slate-400">No data available.</p>
            )}
          </div>
        </div>

        {/* ── Col 3: Reference Image + Validation ── */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 bg-slate-50 flex-shrink-0">
            Reference &amp; Validation
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            {isLoading ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
              </div>
            ) : invoice ? (
              <RefValidationPanel stem={stem} invoice={invoice} />
            ) : (
              <p className="p-4 text-xs text-slate-400">No data available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
