"use client";

import { useEffect, useState } from "react";
import { Loader2, Upload, ScanText, Braces, ShieldCheck, Database, Zap, Info } from "lucide-react";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import DropZone from "@/components/process/DropZone";
import BankExecutionTimeline from "@/components/bank/BankExecutionTimeline";
import { useSSE } from "@/hooks/useSSE";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

const BANK_SESSION_KEY = "bank_process_session";

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
    model: "PaddleOCR / Tesseract",
    skills: ["Image preprocessing", "Text region detection", "Character recognition", "Table layout detection"],
    description: "Converts bank statement PDFs and images into raw text, handling multi-page documents and preserving table structure.",
  },
  {
    name: "Extraction Agent",
    role: "Bank Statement Extraction Expert",
    icon: Braces,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    model: "Ollama · Gemini · OpenAI",
    skills: ["Transaction parsing", "Date normalisation", "Debit/credit detection", "Balance extraction"],
    description: "Uses an LLM to parse raw OCR text into a structured JSON schema with account details, balances, and every transaction row.",
  },
  {
    name: "Validation Agent",
    role: "Bank Statement Validation Auditor",
    icon: ShieldCheck,
    color: "text-amber-600",
    bg: "bg-amber-50",
    model: "Rule-based Engine",
    skills: ["Balance reconciliation", "Total debits check", "Total credits check", "Running balance check", "Currency validation"],
    description: "Runs 5 deterministic checks to verify balances reconcile, totals match transaction sums, and the running balance column is consistent.",
  },
  {
    name: "Storage Agent",
    role: "Bank Statement Storage Manager",
    icon: Database,
    color: "text-teal-600",
    bg: "bg-teal-50",
    model: "SQLite · File Store",
    skills: ["Pass/fail routing", "Database upsert", "JSON persistence", "Audit trail"],
    description: "Saves validated bank statements to SQLite and routes JSON output to the appropriate pass or failed directory.",
  },
];

export default function BankReconciliationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [fileStem, setFileStem] = useState("");
  const [activeJobId, setActiveJobId] = useState("");
  const [polledDone, setPolledDone] = useState(false);
  const { events, isStreaming, isDone, start, reset } = useSSE("bank_sse_session");

  const effectiveDone = isDone || polledDone;
  const isRunning = uploading || isStreaming;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(BANK_SESSION_KEY);
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
          mutate("/api/bank/statements");
          try { sessionStorage.removeItem(BANK_SESSION_KEY); } catch {}
        }
      } catch {
        setActiveJobId("");
        try { sessionStorage.removeItem(BANK_SESSION_KEY); } catch {}
      }
    };
    const interval = setInterval(poll, 3000);
    poll();
    return () => clearInterval(interval);
  }, [activeJobId, effectiveDone, isStreaming]);

  useEffect(() => {
    if (isDone) {
      mutate("/api/bank/statements");
      try { sessionStorage.removeItem(BANK_SESSION_KEY); } catch {}
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
      const res = await api.post("/api/bank/process", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { stream_url, stem } = res.data;
      const derivedStem = stem || file.name.replace(/\.[^.]+$/, "");
      setFileStem(derivedStem);
      setActiveJobId(res.data.job_id);
      try {
        sessionStorage.setItem(BANK_SESSION_KEY, JSON.stringify({ jobId: res.data.job_id, fileStem: derivedStem }));
      } catch {}
      setUploading(false);
      start(stream_url);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Upload failed";
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
    try { sessionStorage.removeItem(BANK_SESSION_KEY); } catch {}
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Process Bank Statement</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload a bank statement PDF or image and watch each agent complete in sequence
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
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</>
                ) : isStreaming ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />Process Statement</>
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

          <BankExecutionTimeline
            events={events}
            isStreaming={isStreaming}
            isDone={effectiveDone}
            fileStem={fileStem}
            isPending={uploading}
          />
        </div>

        {/* Right column — agent info panel */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">Pipeline Agents</h2>
            <span className="ml-auto text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <Info className="w-3 h-3" />
              4 agents in sequence
            </span>
          </div>

          {AGENT_INFO.map((agent, i) => {
            const Icon = agent.icon;
            return (
              <div key={agent.name} className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100 border border-slate-200">
                    <Icon className={cn("w-4 h-4", agent.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn("text-sm font-semibold", agent.color)}>{agent.name}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Step {i + 1}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{agent.role}</p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed mb-3 text-slate-500">{agent.description}</p>
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border bg-slate-50 border-slate-200 mb-3">
                  <span className="text-[10px] font-semibold text-slate-400">Model / Tech:</span>
                  <span className="text-[10px] text-slate-500">{agent.model}</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.skills.map((skill) => (
                      <span key={skill} className="text-[10px] font-medium px-2 py-0.5 rounded-full border text-slate-500 bg-slate-50 border-slate-200">
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
