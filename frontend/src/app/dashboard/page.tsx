"use client";

import { FileText, CheckCircle, XCircle, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvoiceList } from "@/hooks/useInvoices";
import Link from "next/link";

export default function DashboardPage() {
  const { invoices, total, isLoading } = useInvoiceList();

  const passed = invoices.filter((i) => i.status === "pass").length;
  const failed = invoices.filter((i) => i.status === "failed").length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const recent = [...invoices].reverse().slice(0, 5);

  const stats = [
    { label: "Total Invoices", value: total, icon: FileText, color: "text-slate-600", bg: "bg-slate-100" },
    { label: "Passed Validation", value: passed, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Failed Validation", value: failed, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Pass Rate", value: `${passRate}%`, icon: Cpu, color: "text-violet-600", bg: "bg-violet-50" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of your Invoice OCR Agent pipeline</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
                <div className={`${bg} p-2 rounded-lg`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-700">Agent Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: "OCR Agent", color: "bg-blue-500", desc: "Extracts raw text from invoice files using PaddleOCR / Tesseract" },
              { name: "Extraction Agent", color: "bg-violet-500", desc: "Parses OCR text into structured JSON using LLM (Ollama / Gemini / OpenAI)" },
              { name: "Validation Agent", color: "bg-amber-500", desc: "Runs 5 mathematical reconciliation checks on extracted data" },
              { name: "Storage Agent", color: "bg-emerald-500", desc: "Routes validated JSON to pass/ or failed/ directory" },
            ].map((agent, i) => (
              <div key={agent.name} className="flex items-start gap-3">
                <div className="flex flex-col items-center mt-1">
                  <div className={`w-2 h-2 rounded-full ${agent.color}`} />
                  {i < 3 && <div className="w-px h-8 bg-slate-200 mt-1" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{agent.name}</p>
                  <p className="text-xs text-slate-500">{agent.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-700">Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8" />)}
              </div>
            ) : recent.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No invoices processed yet</p>
            ) : (
              <div className="space-y-1">
                {recent.map((inv) => (
                  <Link
                    key={inv.stem}
                    href={`/invoices/${inv.stem}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm text-slate-700 font-mono">{inv.filename}</span>
                    <Badge
                      variant="outline"
                      className={
                        inv.status === "pass"
                          ? "border-emerald-200 text-emerald-700 bg-emerald-50 text-xs"
                          : "border-red-200 text-red-700 bg-red-50 text-xs"
                      }
                    >
                      {inv.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
