"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import DropZone from "@/components/process/DropZone";
import ExecutionTimeline from "@/components/process/ExecutionTimeline";
import { useSSE } from "@/hooks/useSSE";
import api from "@/lib/api";

export default function ProcessPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [fileStem, setFileStem] = useState("");
  const { events, isStreaming, isDone, start, reset } = useSSE();

  const isRunning = uploading || isStreaming;

  async function handleProcess() {
    if (!file) return;
    setError("");
    setUploading(true);
    reset();

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await api.post("/api/process", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { stream_url, stem } = res.data;
      setFileStem(stem || file.name.replace(/\.[^.]+$/, ""));
      setUploading(false);
      await start(stream_url);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Upload failed";
      setError(msg);
      setUploading(false);
    }
  }

  function handleReset() {
    reset();
    setFile(null);
    setError("");
    setFileStem("");
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Process Invoice</h1>
        <p className="text-sm text-zinc-500 mt-1">Upload an invoice file and watch the agents work in real-time</p>
      </div>

      {/* Agent info cards */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {[
          { name: "OCR Agent", color: "blue", desc: "Extracts raw text" },
          { name: "Extraction Agent", color: "violet", desc: "Structures into JSON" },
          { name: "Validation Agent", color: "amber", desc: "Runs 5 math checks" },
          { name: "Storage Agent", color: "emerald", desc: "Saves to pass/failed" },
        ].map(({ name, color, desc }) => (
          <div key={name} className={`bg-${color}-500/5 border border-${color}-500/15 rounded-lg p-3`}>
            <div className={`w-1.5 h-1.5 rounded-full bg-${color}-400 mb-2`} />
            <p className="text-xs font-medium text-zinc-300">{name}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {/* Upload section */}
      <div className="bg-[#111] border border-white/[0.07] rounded-xl p-6 space-y-5">
        <DropZone onFile={setFile} disabled={isRunning} />

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleProcess}
            disabled={!file || isRunning}
            className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-medium"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
            ) : isStreaming ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Agents running...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" />Process Invoice</>
            )}
          </Button>

          {(isDone || error) && (
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-white/[0.1] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]"
            >
              Process Another
            </Button>
          )}
        </div>
      </div>

      {/* Execution timeline */}
      <ExecutionTimeline
        events={events}
        isStreaming={isStreaming}
        isDone={isDone}
        fileStem={fileStem}
      />
    </div>
  );
}
