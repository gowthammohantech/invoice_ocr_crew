"use client";

import { CheckCircle, XCircle, AlertTriangle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvoiceDetail } from "@/hooks/useInvoices";

export default function ValidationTab({ stem }: { stem: string }) {
  const { invoice, isLoading, error } = useInvoiceDetail(stem);

  if (isLoading) return <Skeleton className="h-64 rounded-lg" />;
  if (error) return <p className="text-red-600 text-sm">Failed to load validation data.</p>;
  if (!invoice?.validation) return <p className="text-slate-400 text-sm">No validation data available.</p>;

  const { validation } = invoice;
  const overall = validation.passed;

  return (
    <div className="space-y-4">
      {/* Overall result */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${
        overall === true
          ? "bg-emerald-50 border-emerald-200"
          : overall === false
          ? "bg-amber-50 border-amber-200"
          : "bg-slate-50 border-slate-200"
      }`}>
        {overall === true ? (
          <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
        ) : overall === false ? (
          <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-6 h-6 text-slate-400 flex-shrink-0" />
        )}
        <div>
          <p className={`font-semibold ${overall === true ? "text-emerald-700" : overall === false ? "text-amber-700" : "text-slate-600"}`}>
            {overall === true ? "All checks passed" : overall === false ? "Validation warning" : "Validation inconclusive"}
          </p>
          {validation.failed_checks.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">{validation.failed_checks.length} check(s) with warnings</p>
          )}
        </div>
      </div>

      {/* Per-check breakdown */}
      <div className="space-y-2">
        {(validation.checks as unknown as Record<string, unknown>[]).map((check, i: number) => {
          const name = (check.name as string) || `Check ${i + 1}`;
          const passed = check.passed as boolean;
          return (
            <div
              key={i}
              className={`rounded-lg p-4 flex items-start gap-3 shadow-sm border ${passed ? "bg-white border-slate-200" : "bg-amber-50 border-amber-200"}`}
            >
              {passed ? (
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-slate-800">{name}</p>
                  <Badge
                    variant="outline"
                    className={
                      passed
                        ? "border-emerald-200 text-emerald-700 bg-emerald-50 text-[10px] px-1.5 py-0"
                        : "border-amber-200 text-amber-700 bg-amber-50 text-[10px] px-1.5 py-0"
                    }
                  >
                    {passed ? "pass" : "warn"}
                  </Badge>
                </div>
                {Object.entries(check)
                  .filter(([k]) => !["name", "passed"].includes(k))
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="text-slate-400 w-24 flex-shrink-0">{k}:</span>
                      <span className="text-slate-600 font-mono">{String(v)}</span>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
