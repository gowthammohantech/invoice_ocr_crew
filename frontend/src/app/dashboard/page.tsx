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
    { label: "Total Invoices", value: total, icon: FileText, color: "text-zinc-400", bg: "bg-zinc-500/10" },
    { label: "Passed Validation", value: passed, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Failed Validation", value: failed, icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "Pass Rate", value: `${passRate}%`, icon: Cpu, color: "text-violet-400", bg: "bg-violet-500/10" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Overview of your Invoice OCR Agent pipeline</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="bg-[#111] border-white/[0.07]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{label}</p>
                <div className={`${bg} p-2 rounded-lg`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-16 bg-white/[0.05]" />
              ) : (
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="bg-[#111] border-white/[0.07]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">Agent Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: "OCR Agent", role: "OCR Specialist", color: "bg-blue-500", desc: "Extracts raw text from invoice files using PaddleOCR / Tesseract" },
              { name: "Extraction Agent", role: "Data Extraction Expert", color: "bg-violet-500", desc: "Parses OCR text into structured JSON using LLM (Ollama / Gemini / OpenAI)" },
              { name: "Validation Agent", role: "Invoice Auditor", color: "bg-amber-500", desc: "Runs 5 mathematical reconciliation checks on extracted data" },
              { name: "Storage Agent", role: "Storage Manager", color: "bg-emerald-500", desc: "Routes validated JSON to pass/ or failed/ directory" },
            ].map((agent, i) => (
              <div key={agent.name} className="flex items-start gap-3">
                <div className="flex flex-col items-center mt-1">
                  <div className={`w-2 h-2 rounded-full ${agent.color}`} />
                  {i < 3 && <div className="w-px h-8 bg-white/[0.06] mt-1" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{agent.name}</p>
                  <p className="text-xs text-zinc-500">{agent.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="bg-[#111] border-white/[0.07]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 bg-white/[0.05]" />)}
              </div>
            ) : recent.length === 0 ? (
              <p className="text-sm text-zinc-600 py-4 text-center">No invoices processed yet</p>
            ) : (
              <div className="space-y-1">
                {recent.map((inv) => (
                  <Link
                    key={inv.stem}
                    href={`/invoices/${inv.stem}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="text-sm text-zinc-300 font-mono">{inv.filename}</span>
                    <Badge
                      variant="outline"
                      className={
                        inv.status === "pass"
                          ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-xs"
                          : "border-red-500/30 text-red-400 bg-red-500/10 text-xs"
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
