"use client";

import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvoiceDetail } from "@/hooks/useInvoices";

export default function ValidationTab({ stem }: { stem: string }) {
  const { invoice, isLoading, error } = useInvoiceDetail(stem);

  if (isLoading) return <Skeleton className="h-64 bg-white/[0.05] rounded-lg" />;
  if (error) return <p className="text-red-400 text-sm">Failed to load validation data.</p>;
  if (!invoice?.validation) return <p className="text-zinc-600 text-sm">No validation data available.</p>;

  const { validation } = invoice;
  const overall = validation.passed;

  return (
    <div className="space-y-4">
      {/* Overall result */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${
        overall === true
          ? "bg-emerald-500/10 border-emerald-500/20"
          : overall === false
          ? "bg-red-500/10 border-red-500/20"
          : "bg-zinc-500/10 border-zinc-500/20"
      }`}>
        {overall === true ? (
          <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
        ) : overall === false ? (
          <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-6 h-6 text-zinc-400 flex-shrink-0" />
        )}
        <div>
          <p className={`font-semibold ${overall === true ? "text-emerald-300" : overall === false ? "text-red-300" : "text-zinc-300"}`}>
            {overall === true ? "All checks passed" : overall === false ? "Validation failed" : "Validation inconclusive"}
          </p>
          {validation.failed_checks.length > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">{validation.failed_checks.length} check(s) failed</p>
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
              className="bg-[#111] border border-white/[0.07] rounded-lg p-4 flex items-start gap-3"
            >
              {passed ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-zinc-200">{name}</p>
                  <Badge
                    variant="outline"
                    className={
                      passed
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px] px-1.5 py-0"
                        : "border-red-500/30 text-red-400 bg-red-500/10 text-[10px] px-1.5 py-0"
                    }
                  >
                    {passed ? "pass" : "fail"}
                  </Badge>
                </div>
                {Object.entries(check)
                  .filter(([k]) => !["name", "passed"].includes(k))
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="text-zinc-600 w-24 flex-shrink-0">{k}:</span>
                      <span className="text-zinc-400 font-mono">{String(v)}</span>
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
