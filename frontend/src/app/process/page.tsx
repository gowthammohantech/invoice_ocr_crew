"use client";

import { useEffect, useState } from "react";
import { Loader2, Upload, ScanText, Braces, ShieldCheck, Database, Zap, Info } from "lucide-react";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import DropZone from "@/components/process/DropZone";
import ExecutionTimeline from "@/components/process/ExecutionTimeline";
import { useSSE } from "@/hooks/useSSE";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

const PROCESS_SESSION_KEY = "invoice_process_session";

interface ProcessSession {
  jobId: string;
  fileStem: string;
}


const AGENT_INFO = [
  {
    name: "OCR Agent",
    role: "OCR Specialist",
    icon: ScanText,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    activeBorder: "border-blue-400",
    ring: "ring-blue-300",
    dotBg: "bg-blue-500",
    model: "PaddleOCR / Tesseract",
    skills: ["Image preprocessing", "Text region detection", "Character recognition", "Multi-language support"],
    description: "Converts invoice images and PDFs into raw text by detecting layout regions and running optical character recognition.",
  },
  {
    name: "Extraction Agent",
    role: "Invoice Data Extraction Expert",
    icon: Braces,
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    activeBorder: "border-violet-400",
    ring: "ring-violet-300",
    dotBg: "bg-violet-500",
    model: "Ollama · Gemini · OpenAI",
    skills: ["Field identification", "JSON structuring", "Date/amount parsing", "Vendor & line-item extraction"],
    description: "Uses an LLM to parse raw OCR text into a structured JSON schema with fields like vendor, total, line items and tax.",
  },
  {
    name: "Validation Agent",
    role: "Invoice Validation Auditor",
    icon: ShieldCheck,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    activeBorder: "border-amber-400",
    ring: "ring-amber-300",
    dotBg: "bg-amber-500",
    model: "Rule-based Engine",
    skills: ["Subtotal reconciliation", "Tax calculation check", "Total amount verification", "Line item sum check", "Discount validation"],
    description: "Runs 5 deterministic math checks to ensure extracted figures are internally consistent before storage.",
  },
  {
    name: "Storage Agent",
    role: "Elixir Books Publisher",
    icon: Database,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    activeBorder: "border-emerald-400",
    ring: "ring-emerald-300",
    dotBg: "bg-emerald-500",
    model: "SQLite · File Store",
    skills: ["Pass/fail routing", "Database upsert", "JSON file persistence", "Audit trail creation"],
    description: "Saves validated invoices to SQLite and routes JSON output to the appropriate pass or failed directory.",
  },
];

export default function ProcessPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [fileStem, setFileStem] = useState("");
  const [activeJobId, setActiveJobId] = useState("");
  const [polledDone, setPolledDone] = useState(false);
  const { events, isStreaming, isDone, start, reset } = useSSE();

  const effectiveDone = isDone || polledDone;
  const isRunning = uploading || isStreaming;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PROCESS_SESSION_KEY);
      if (raw) {
        const s: ProcessSession = JSON.parse(raw);
        if (s.fileStem) setFileStem(s.fileStem);
        if (s.jobId) setActiveJobId(s.jobId);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!activeJobId || effectiveDone || isStreaming) return;

    const poll = async () => {
      try {
        const res = await api.get(`/api/job/${activeJobId}`);
        const status = res.data.status;
        if (status === "done" || status === "failed") {
          setPolledDone(true);
          mutate("/api/invoices");
          try { sessionStorage.removeItem(PROCESS_SESSION_KEY); } catch {}
        }
      } catch {
        setActiveJobId("");
        try { sessionStorage.removeItem(PROCESS_SESSION_KEY); } catch {}
      }
    };

    const interval = setInterval(poll, 3000);
    poll();
    return () => clearInterval(interval);
  }, [activeJobId, effectiveDone, isStreaming]);

  useEffect(() => {
    if (isDone) {
      mutate("/api/invoices");
      try { sessionStorage.removeItem(PROCESS_SESSION_KEY); } catch {}
    }
  }, [isDone]);

  async function handleProcess() {
    if (!file) return;
    setError("");
    setUploading(true);
    setPolledDone(false);
    reset();

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await api.post("/api/process", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { stream_url, stem } = res.data;
      const derivedStem = stem || file.name.replace(/\.[^.]+$/, "");
      setFileStem(derivedStem);
      setActiveJobId(res.data.job_id);
      try {
        sessionStorage.setItem(
          PROCESS_SESSION_KEY,
          JSON.stringify({ jobId: res.data.job_id, fileStem: derivedStem })
        );
      } catch {}
      setUploading(false);
      start(stream_url);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Upload failed";
      setError(msg);
      setUploading(false);
    }
  }

  function handleReset() {
    reset();
    setFile(null);
    setError("");
    setFileStem("");
    setActiveJobId("");
    setPolledDone(false);
    try { sessionStorage.removeItem(PROCESS_SESSION_KEY); } catch {}
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Process Invoice</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload an invoice and watch each agent complete in sequence
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">

        {/* Left column — upload + timeline */}
        <div className="xl:col-span-3 space-y-0">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-sm">
            <DropZone onFile={setFile} disabled={isRunning} />

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleProcess}
                disabled={!file || isRunning}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-medium"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</>
                ) : isStreaming ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />Process Invoice</>
                )}
              </Button>

              {(effectiveDone || error) && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                >
                  Process Another
                </Button>
              )}
            </div>
          </div>

          <ExecutionTimeline
            events={events}
            isStreaming={isStreaming}
            isDone={effectiveDone}
            fileStem={fileStem}
            isPending={uploading}
          />
        </div>

        {/* Right column — agent info panel */}
        <div className="xl:col-span-2 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 px-1">
            <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">Pipeline Agents</h2>
            <span className="ml-auto text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <Info className="w-3 h-3" />
              4 agents in sequence
            </span>
          </div>

          {/* Agent cards — static info panel, no real-time highlights */}
          {AGENT_INFO.map((agent, i) => {
            const Icon = agent.icon;
            return (
              <div
                key={agent.name}
                className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm"
              >
                {/* Card header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100 border border-slate-200">
                    <Icon className={cn("w-4 h-4", agent.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn("text-sm font-semibold", agent.color)}>
                        {agent.name}
                      </p>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Step {i + 1}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{agent.role}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs leading-relaxed mb-3 text-slate-500">
                  {agent.description}
                </p>

                {/* Model / tech badge */}
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border bg-slate-50 border-slate-200 mb-3">
                  <span className="text-[10px] font-semibold text-slate-400">Model / Tech:</span>
                  <span className="text-[10px] text-slate-500">{agent.model}</span>
                </div>

                {/* Skills */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full border text-slate-500 bg-slate-50 border-slate-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
