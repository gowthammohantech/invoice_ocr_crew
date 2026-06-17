"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle, AlertTriangle, AlertCircle, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBankStatementDetail, useBankStatementList, useBankStatementMeta } from "@/hooks/useBankStatements";
import { BankStatementDetail, BankTransaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function FieldRow({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  const empty = value == null || value === "";
  return (
    <div className="grid grid-cols-[140px_1fr] gap-x-2 py-1.5 border-b border-slate-100 last:border-0">
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

function Section({ title }: { title: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mt-4 mb-1 first:mt-0">
      {title}
    </p>
  );
}

function DataPanel({ statement }: { statement: BankStatementDetail }) {
  return (
    <div className="px-4 py-3">
      <Section title="Account Details" />
      <FieldRow label="Bank"         value={statement.bank_name} />
      <FieldRow label="Account #"    value={statement.account_number} />
      <FieldRow label="Holder"       value={statement.account_holder} />
      <FieldRow label="Account Type" value={statement.account_type} />
      <FieldRow label="IFSC Code"    value={statement.ifsc_code} />
      <FieldRow label="Branch"       value={statement.branch} />
      <FieldRow label="Address"      value={statement.address} />

      <Section title="Statement Period" />
      <FieldRow label="From"     value={statement.statement_from} />
      <FieldRow label="To"       value={statement.statement_to} />
      <FieldRow label="Currency" value={statement.currency} />

      <Section title="Balances" />
      <FieldRow label="Opening Balance" value={fmt(statement.opening_balance)} mono />
      <FieldRow label="Total Credits"   value={fmt(statement.total_credits)}   mono />
      <FieldRow label="Total Debits"    value={fmt(statement.total_debits)}    mono />
      <FieldRow label="Closing Balance" value={fmt(statement.closing_balance)} mono />

      {statement.transactions?.length > 0 && (
        <>
          <Section title={`Transactions (${statement.transactions.length})`} />
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-1.5 pr-2 text-slate-400 font-medium">Date</th>
                  <th className="text-left py-1.5 pr-2 text-slate-400 font-medium">Description</th>
                  <th className="text-left py-1.5 pr-2 text-slate-400 font-medium">Ref</th>
                  <th className="text-right py-1.5 pr-2 text-slate-400 font-medium">Debit</th>
                  <th className="text-right py-1.5 pr-2 text-slate-400 font-medium">Credit</th>
                  <th className="text-right py-1.5 text-slate-400 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {statement.transactions.map((txn: BankTransaction, i: number) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="py-1.5 pr-2 text-slate-500 font-mono whitespace-nowrap">{txn.date || "—"}</td>
                    <td className="py-1.5 pr-2 text-slate-700 max-w-[140px] truncate" title={txn.description}>{txn.description || "—"}</td>
                    <td className="py-1.5 pr-2 text-slate-400 font-mono text-[10px]">{txn.reference || "—"}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {txn.debit != null ? (
                        <span className="text-red-600 flex items-center justify-end gap-0.5">
                          <TrendingDown className="w-2.5 h-2.5" />
                          {fmt(txn.debit)}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {txn.credit != null ? (
                        <span className="text-emerald-600 flex items-center justify-end gap-0.5">
                          <TrendingUp className="w-2.5 h-2.5" />
                          {fmt(txn.credit)}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-1.5 text-right text-sky-700 font-mono">{fmt(txn.balance)}</td>
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

function ValidationPanel({ statement }: { statement: BankStatementDetail }) {
  const validation = statement.validation;
  if (!validation) return <p className="p-4 text-xs text-slate-400">No validation data.</p>;

  return (
    <div className="px-3 py-3 overflow-auto h-full">
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-xs font-semibold",
        validation.passed === true  ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
        validation.passed === false ? "bg-amber-50 text-amber-700 border border-amber-200" :
        "bg-slate-50 text-slate-500 border border-slate-200"
      )}>
        {validation.passed === true  && <CheckCircle   className="w-3.5 h-3.5 flex-shrink-0" />}
        {validation.passed === false && <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
        {validation.passed == null   && <AlertCircle   className="w-3.5 h-3.5 flex-shrink-0" />}
        {validation.passed === true  ? "All checks passed" :
         validation.passed === false ? "Validation warning" : "Inconclusive"}
      </div>

      <div className="space-y-1">
        {(validation.checks as unknown as Record<string, unknown>[]).map((check, i) => {
          const passed   = check.passed as boolean | null;
          const name     = (check.name as string) || `Check ${i + 1}`;
          const delta    = check.delta as number | undefined;
          const expected = check.expected as number | undefined;
          const computed = check.computed as number | undefined;
          const note     = check.note as string | undefined;
          return (
            <div key={i} className={cn(
              "flex items-start gap-2 px-2 py-1.5 rounded-md text-xs",
              passed === true  ? "bg-emerald-50" :
              passed === false ? "bg-amber-50"   : "bg-slate-50"
            )}>
              {passed === true  && <CheckCircle   className="w-3 h-3 text-emerald-500 mt-px flex-shrink-0" />}
              {passed === false && <AlertTriangle className="w-3 h-3 text-amber-500 mt-px flex-shrink-0" />}
              {passed == null   && <AlertCircle   className="w-3 h-3 text-slate-400 mt-px flex-shrink-0" />}
              <div className="min-w-0">
                <p className={cn(
                  "font-medium truncate",
                  passed === true  ? "text-emerald-700" :
                  passed === false ? "text-amber-700"   : "text-slate-500"
                )}>{name}</p>
                {delta != null && (
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    expected {fmt(expected)} · got {fmt(computed)} · Δ{fmt(delta)}
                  </p>
                )}
                {note && <p className="text-[10px] text-slate-400 mt-0.5">{note}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BankStatementDetailPage() {
  const { stem } = useParams<{ stem: string }>();
  const router = useRouter();
  const { statement, isLoading } = useBankStatementDetail(stem);
  const { meta }                 = useBankStatementMeta(stem);
  const { statements }           = useBankStatementList();

  const passed   = statement?.validation?.passed;
  const filename = meta?.filename;
  const fileUrl  = filename ? `${API_BASE}/bank-files/${filename}` : null;

  const currentIndex = statements.findIndex((s) => s.stem === stem);
  const prevStem = currentIndex > 0 ? statements[currentIndex - 1].stem : null;
  const nextStem = currentIndex >= 0 && currentIndex < statements.length - 1
    ? statements[currentIndex + 1].stem : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft"  && prevStem) router.push(`/bank-statements/${prevStem}`);
      if (e.key === "ArrowRight" && nextStem) router.push(`/bank-statements/${nextStem}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevStem, nextStem, router]);

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
      {/* Page header */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-200 bg-white flex-shrink-0">
        <Link
          href="/bank-statements"
          className="flex items-center gap-1 text-slate-400 hover:text-slate-700 text-xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>
        <span className="text-slate-300">|</span>

        <button
          onClick={() => prevStem && router.push(`/bank-statements/${prevStem}`)}
          disabled={!prevStem}
          title="Previous (←)"
          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => nextStem && router.push(`/bank-statements/${nextStem}`)}
          disabled={!nextStem}
          title="Next (→)"
          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        {statements.length > 0 && currentIndex >= 0 && (
          <span className="text-[10px] text-slate-300 tabular-nums">{currentIndex + 1}/{statements.length}</span>
        )}

        <span className="text-slate-300">|</span>
        <h1 className="text-sm font-semibold text-slate-800 font-mono">{stem}</h1>
        {isLoading ? (
          <Skeleton className="h-5 w-14" />
        ) : statement ? (
          <Badge
            variant="outline"
            className={cn(
              "text-xs gap-1 py-0",
              passed === true  ? "border-emerald-200 text-emerald-700 bg-emerald-50" :
              passed === false ? "border-amber-200 text-amber-700 bg-amber-50" :
              "border-slate-200 text-slate-500 bg-slate-50"
            )}
          >
            {passed === true  && <CheckCircle   className="w-2.5 h-2.5" />}
            {passed === false && <AlertTriangle className="w-2.5 h-2.5" />}
            {passed === true ? "passed" : passed === false ? "warning" : "unknown"}
          </Badge>
        ) : null}

        {statement?.bank_name && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-600 font-medium">{statement.bank_name}</span>
            {statement.account_holder && (
              <span className="text-xs text-slate-400">· {statement.account_holder}</span>
            )}
          </div>
        )}
      </div>

      {/* 3-column body */}
      <div
        className="flex-1 grid overflow-hidden min-h-0"
        style={{ gridTemplateColumns: "1fr 380px 280px" }}
      >
        {/* Col 1: PDF viewer */}
        <div className="flex flex-col overflow-hidden border-r border-slate-200">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 bg-slate-50 flex-shrink-0">
            Statement Document
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Skeleton className="w-full h-full" />
              </div>
            ) : fileUrl ? (
              <iframe src={fileUrl} className="w-full h-full border-0" title="Bank statement document" />
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

        {/* Col 2: Extracted data + transactions */}
        <div className="flex flex-col overflow-hidden border-r border-slate-200">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 bg-slate-50 flex-shrink-0">
            Extracted Data
          </div>
          <div className="flex-1 overflow-auto min-h-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(12)].map((_, i) => <Skeleton key={i} className="h-4" />)}
              </div>
            ) : statement ? (
              <DataPanel statement={statement} />
            ) : (
              <p className="p-4 text-xs text-slate-400">No data available.</p>
            )}
          </div>
        </div>

        {/* Col 3: Validation */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 bg-slate-50 flex-shrink-0">
            Validation Checks
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 rounded-md" />)}
              </div>
            ) : statement ? (
              <ValidationPanel statement={statement} />
            ) : (
              <p className="p-4 text-xs text-slate-400">No data available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
