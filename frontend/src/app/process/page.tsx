"use client";

import { useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import DropZone from "@/components/process/DropZone";
import ExecutionTimeline from "@/components/process/ExecutionTimeline";
import { useSSE } from "@/hooks/useSSE";
import api from "@/lib/api";

const PROCESS_SESSION_KEY = "invoice_process_session";

interface ProcessSession {
  jobId: string;
  fileStem: string;
}

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

  // Restore fileStem + jobId from session on mount
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

  // Poll job status when we have a jobId but SSE is not live and not yet done
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
        // Job not found (server restarted) — stop polling
        setActiveJobId("");
        try { sessionStorage.removeItem(PROCESS_SESSION_KEY); } catch {}
      }
    };

    const interval = setInterval(poll, 3000);
    poll();
    return () => clearInterval(interval);
  }, [activeJobId, effectiveDone, isStreaming]);

  // When SSE reports done, refresh the invoice list
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
      start(stream_url);   // EventSource — non-blocking, fires onmessage per event
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
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Process Invoice</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload an invoice and watch each agent complete in sequence
        </p>
      </div>

      {/* Upload card */}
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

      {/* Pipeline */}
      <ExecutionTimeline
        events={events}
        isStreaming={isStreaming}
        isDone={effectiveDone}
        fileStem={fileStem}
      />
    </div>
  );
}
