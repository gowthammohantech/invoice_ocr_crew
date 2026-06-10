"use client";

import { FileText, CheckCircle, AlertTriangle, ScanText, Braces, ShieldCheck, Database, ArrowRight, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvoiceList } from "@/hooks/useInvoices";
import Link from "next/link";

const PIPELINE = [
  {
    name: "OCR Agent",
    role: "OCR Specialist",
    icon: ScanText,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    dot: "bg-blue-500",
    desc: "Extracts raw text from invoice files using PaddleOCR / Tesseract",
    tag: "PaddleOCR · Tesseract",
  },
  {
    name: "Extraction Agent",
    role: "Invoice Data Extraction Expert",
    icon: Braces,
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    dot: "bg-violet-500",
    desc: "Parses OCR text into structured JSON using LLM",
    tag: "Ollama · Gemini · OpenAI",
  },
  {
    name: "Validation Agent",
    role: "Invoice Validation Auditor",
    icon: ShieldCheck,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
    desc: "Runs 5 mathematical reconciliation checks on extracted data",
    tag: "5 Checks · Math Audit",
  },
  {
    name: "Storage Agent",
    role: "Elixir Books Publisher",
    icon: Database,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    desc: "Routes validated JSON to pass or failed directory and publishes to Elixir Books",
    tag: "Elixir Books · File Store",
  },
];

export default function DashboardPage() {
  const { invoices, total, isLoading } = useInvoiceList();

  const passed = invoices.filter((i) => i.status === "pass").length;
  const failed = invoices.filter((i) => i.status === "failed").length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const recent = [...invoices].reverse().slice(0, 6);

  const stats = [
    { label: "Total Invoices", value: total, icon: FileText, color: "text-slate-700", bg: "bg-slate-100", border: "border-slate-200" },
    { label: "Passed Validation", value: passed, icon: CheckCircle, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    { label: "Warnings", value: failed, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
    { label: "Pass Rate", value: `${passRate}%`, icon: TrendingUp, color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  ];

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of your Invoice OCR Agent pipeline</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg, border }) => (
          <Card key={label} className={`bg-white border shadow-sm ${border}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
                <div className={`${bg} p-2 rounded-lg border ${border}`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline + Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Agent Pipeline — takes 3/5 */}
        <Card className="bg-white border-slate-200 shadow-sm lg:col-span-3">
          <CardHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center justify-between p-4">
              <CardTitle className="text-sm font-semibold text-slate-800">Agent Pipeline</CardTitle>
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600 bg-violet-50 border border-violet-200 px-4 py-0.5 rounded-full">
                4 Agents
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-2 px-4">
            <div className="space-y-1">
              {PIPELINE.map((agent, i) => {
                const Icon = agent.icon;
                return (
                  <div key={agent.name}>
                    <div className={`flex items-start gap-3 rounded-xl border ${agent.border} ${agent.bg} px-4 py-3`}>
                      {/* Step number + icon */}
                      <div className="flex flex-col items-center mt-0.5 flex-shrink-0">
                        <div className={`w-8 h-8 rounded-lg ${agent.bg} border ${agent.border} flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${agent.color}`} />
                        </div>
                        <span className={`text-[10px] font-bold mt-1 ${agent.color}`}>{i + 1}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${agent.color}`}>{agent.name}</p>
                          <span className={`text-[10px] font-medium ${agent.color} bg-white border ${agent.border} px-2 py-0.5 rounded-full whitespace-nowrap`}>
                            {agent.tag}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{agent.desc}</p>
                      </div>
                    </div>

                    {/* Connector arrow */}
                    {i < PIPELINE.length - 1 && (
                      <div className="flex justify-center py-1">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 rotate-90" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Invoices — takes 2/5 */}
        <Card className="bg-white border-slate-200 shadow-sm lg:col-span-2 px-2">
          <CardHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center justify-between p-4">
              <CardTitle className="text-sm font-semibold text-slate-800">Recent Invoices</CardTitle>
              {!isLoading && total > 0 && (
                <Link href="/invoices" className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors">
                  View all →
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-3 pb-2">
            {isLoading ? (
              <div className="space-y-2 pt-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="py-10 text-center">
                <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No invoices processed yet</p>
                <Link href="/process" className="text-xs text-violet-600 hover:underline mt-1 inline-block">
                  Process your first invoice →
                </Link>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="flex items-center justify-between px-2 pb-1 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filename</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                </div>
                <div className="space-y-0.5">
                  {recent.map((inv) => (
                    <Link
                      key={inv.stem}
                      href={`/invoices/${inv.stem}`}
                      className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 group-hover:text-slate-400 transition-colors" />
                        <span className="text-xs text-slate-700 font-mono truncate max-w-[130px]" title={inv.filename}>
                          {inv.filename}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          inv.status === "pass"
                            ? "border-emerald-200 text-emerald-700 bg-emerald-50 text-[10px] font-semibold px-2"
                            : "border-amber-200 text-amber-700 bg-amber-50 text-[10px] font-semibold px-2"
                        }
                      >
                        {inv.status === "pass" ? "✓ Pass" : "⚠ Warn"}
                      </Badge>
                    </Link>
                  ))}
                </div>

                {total > 6 && (
                  <div className="pt-2 border-t border-slate-100 mt-2">
                    <Link href="/invoices" className="block text-center text-xs text-slate-400 hover:text-violet-600 transition-colors py-1">
                      +{total - 6} more invoices
                    </Link>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
