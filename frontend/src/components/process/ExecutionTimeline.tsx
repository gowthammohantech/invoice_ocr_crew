"use client";

import { CheckCircle, XCircle, Loader2, Wrench, Play, Zap } from "lucide-react";
import Link from "next/link";
import { SSEEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const AGENT_COLORS: Record<string, { dot: string; badge: string }> = {
  "OCR Specialist":                  { dot: "bg-blue-500",    badge: "bg-blue-50 text-blue-700 border-blue-200" },
  "Invoice Data Extraction Expert":  { dot: "bg-violet-500",  badge: "bg-violet-50 text-violet-700 border-violet-200" },
  "Invoice Validation Auditor":      { dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border-amber-200" },
  "Invoice Storage Manager":         { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

function agentStyle(role: string) {
  for (const [key, val] of Object.entries(AGENT_COLORS)) {
    if (role.includes(key.split(" ")[0])) return val;
  }
  return { dot: "bg-slate-400", badge: "bg-slate-50 text-slate-600 border-slate-200" };
}

function EventRow({ event, isLast }: { event: SSEEvent; isLast: boolean }) {
  const role = event.agent_role || "";
  const style = agentStyle(role);

  if (event.type === "crew_started") {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="flex flex-col items-center w-6">
          <div className="w-6 h-6 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center">
            <Play className="w-3 h-3 text-violet-600" />
          </div>
          {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1 min-h-[12px]" />}
        </div>
        <p className="text-sm text-slate-500 italic">Crew started</p>
      </div>
    );
  }

  if (event.type === "task_started") {
    return (
      <div className="flex items-start gap-3 py-2">
        <div className="flex flex-col items-center w-6">
          <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5", style.dot)} />
          {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1 min-h-[20px]" />}
        </div>
        <div>
          <div className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md border mb-1", style.badge)}>
            <Zap className="w-3 h-3" />
            {role || "Agent"}
          </div>
          <p className="text-sm text-slate-700">{event.description}</p>
        </div>
      </div>
    );
  }

  if (event.type === "tool_started") {
    return (
      <div className="flex items-start gap-3 py-1 ml-4">
        <div className="flex flex-col items-center w-6">
          <Wrench className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
          {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1 min-h-[12px]" />}
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
          <span className="text-xs text-slate-500 font-mono">{event.tool_name}</span>
        </div>
      </div>
    );
  }

  if (event.type === "tool_finished") {
    return (
      <div className="flex items-start gap-3 py-1 ml-4">
        <div className="flex flex-col items-center w-6">
          <Wrench className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
          {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1 min-h-[12px]" />}
        </div>
        <span className="text-xs text-slate-400 font-mono">{event.tool_name} done</span>
      </div>
    );
  }

  if (event.type === "task_completed") {
    return (
      <div className="flex items-start gap-3 py-2">
        <div className="flex flex-col items-center w-6">
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1 min-h-[12px]" />}
        </div>
        <div>
          <p className="text-sm text-emerald-700 font-medium">{role} — complete</p>
          {event.preview && (
            <p className="text-xs text-slate-400 font-mono mt-1 max-w-lg truncate">{event.preview}</p>
          )}
        </div>
      </div>
    );
  }

  if (event.type === "task_failed") {
    return (
      <div className="flex items-start gap-3 py-2">
        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-red-700 font-medium">{role} — failed</p>
          {event.error && <p className="text-xs text-slate-500 mt-0.5">{event.error}</p>}
        </div>
      </div>
    );
  }

  if (event.type === "crew_failed") {
    return (
      <div className="flex items-center gap-3 py-2 px-3 bg-red-50 border border-red-200 rounded-lg">
        <XCircle className="w-5 h-5 text-red-500" />
        <p className="text-sm text-red-700">Processing failed: {event.error}</p>
      </div>
    );
  }

  return null;
}

interface Props {
  events: SSEEvent[];
  isStreaming: boolean;
  isDone: boolean;
  fileStem?: string;
}

export default function ExecutionTimeline({ events, isStreaming, isDone, fileStem }: Props) {
  if (events.length === 0 && !isStreaming && !isDone) return null;

  const completedEvent = events.find((e) => e.type === "crew_completed");
  const resolvedStem = completedEvent?.file_stem || fileStem;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mt-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-700">Agent Execution</h3>
        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-violet-600">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            Running
          </div>
        )}
        {isDone && !completedEvent && events.find((e) => e.type !== "crew_failed") && (
          <span className="text-xs text-slate-400">Completed</span>
        )}
      </div>

      <div className="space-y-0">
        {events.length === 0 && isStreaming && (
          <div className="flex items-center gap-3 py-3">
            <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
            <span className="text-sm text-slate-500">Connecting to agent stream...</span>
          </div>
        )}
        {events.map((evt, i) => (
          <EventRow key={i} event={evt} isLast={i === events.length - 1 && !isStreaming} />
        ))}
        {isStreaming && events.length > 0 && (
          <div className="flex items-center gap-3 py-2 ml-0.5">
            <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
            <span className="text-sm text-slate-400">Processing...</span>
          </div>
        )}
      </div>

      {(completedEvent || (isDone && !events.find((e) => e.type === "crew_failed"))) && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-emerald-700 font-medium">Processing complete</p>
              {completedEvent?.result_path && (
                <p className="text-xs text-slate-500 mt-0.5 font-mono">{completedEvent.result_path}</p>
              )}
            </div>
            {resolvedStem && (
              <Link
                href={`/invoices/${resolvedStem}`}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-md transition-colors"
              >
                View Invoice
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
