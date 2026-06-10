"use client";

import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { SSEEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Stage definitions ────────────────────────────────────────────────────

const STAGES = [
  {
    id: "ocr",
    name: "OCR",
    role: "OCR Specialist",
    desc: "Extract text from file",
    activeColor: "border-blue-400 bg-blue-50 shadow-sm shadow-blue-100",
    dotColor:    "bg-blue-500",
    labelColor:  "text-blue-700",
  },
  {
    id: "extract",
    name: "Extraction",
    role: "Invoice Data Extraction Expert",
    desc: "Parse fields into JSON",
    activeColor: "border-violet-400 bg-violet-50 shadow-sm shadow-violet-100",
    dotColor:    "bg-violet-500",
    labelColor:  "text-violet-700",
  },
  {
    id: "validate",
    name: "Validation",
    role: "Invoice Validation Auditor",
    desc: "Check math & totals",
    activeColor: "border-amber-400 bg-amber-50 shadow-sm shadow-amber-100",
    dotColor:    "bg-amber-500",
    labelColor:  "text-amber-700",
  },
  {
    id: "store",
    name: "Publish",
    role: "Elixir Books Publisher",
    desc: "Publish to Elixir Books",
    activeColor: "border-emerald-400 bg-emerald-50 shadow-sm shadow-emerald-100",
    dotColor:    "bg-emerald-500",
    labelColor:  "text-emerald-700",
  },
] as const;

type StageState = "idle" | "active" | "done" | "failed";

// ── Helpers ──────────────────────────────────────────────────────────────

function getState(role: string, events: SSEEvent[]): StageState {
  if (events.some(e => e.type === "task_failed"    && e.agent_role === role)) return "failed";
  if (events.some(e => e.type === "task_completed" && e.agent_role === role)) return "done";
  if (events.some(e => e.type === "task_started"   && e.agent_role === role)) return "active";
  return "idle";
}

function getActiveTool(role: string, events: SSEEvent[]): string | null {
  // Walk backwards from the end; stop at the first event belonging to this role
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.agent_role !== role) continue;
    if (e.type === "task_completed" || e.type === "task_failed") return null;
    if (e.type === "tool_started") return e.tool_name ?? null;
  }
  return null;
}

// ── Stage card ────────────────────────────────────────────────────────────

function StageCard({
  stage,
  state,
  tool,
  isStreaming,
}: {
  stage: typeof STAGES[number];
  state: StageState;
  tool: string | null;
  isStreaming: boolean;
}) {
  const cardCls =
    state === "active" ? cn("border-2 transition-all duration-300", stage.activeColor) :
    state === "done"   ? "border border-emerald-200 bg-emerald-50" :
    state === "failed" ? "border border-amber-200 bg-amber-50" :
                         "border border-slate-200 bg-slate-50";

  return (
    <div className={cn("rounded-xl p-4 flex flex-col gap-2", cardCls)}>
      {/* Header row */}
      <div className="flex items-center justify-between min-h-[20px]">
        <div className="flex items-center gap-2">
          {state === "idle"   && <div className="w-2 h-2 rounded-full bg-slate-300" />}
          {state === "active" && <div className={cn("w-2 h-2 rounded-full animate-pulse", stage.dotColor)} />}
          {state === "done"   && <CheckCircle   className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
          {state === "failed" && <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
          <span className={cn(
            "text-sm font-semibold",
            state === "active" ? stage.labelColor :
            state === "done"   ? "text-emerald-700" :
            state === "failed" ? "text-amber-700" :
            "text-slate-400"
          )}>
            {stage.name}
          </span>
        </div>
        {state === "active" && isStreaming && (
          <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
        )}
      </div>

      {/* Description / tool */}
      <p className={cn("text-xs", state === "idle" ? "text-slate-400" : "text-slate-500")}>
        {state === "active" && tool ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
            <span className="font-mono truncate">{tool}</span>
          </span>
        ) : stage.desc}
      </p>

      {/* Status label */}
      {state === "done"   && <span className="text-[11px] font-medium text-emerald-600">Complete</span>}
      {state === "failed" && <span className="text-[11px] font-medium text-amber-600">Warning</span>}
      {state === "active" && !tool && (
        <span className={cn("text-[11px] font-medium", stage.labelColor)}>Running…</span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

interface Props {
  events: SSEEvent[];
  isStreaming: boolean;
  isDone: boolean;
  fileStem?: string;
  isPending?: boolean;
}

export default function ExecutionTimeline({ events, isStreaming, isDone, fileStem, isPending }: Props) {
  if (events.length === 0 && !isStreaming && !isDone && !isPending) return null;

  const crewCompleted = events.find(e => e.type === "crew_completed");
  const crewFailed    = events.find(e => e.type === "crew_failed");
  const resolvedStem  = crewCompleted?.file_stem || fileStem;
  const allDone       = isDone && !crewFailed;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mt-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Pipeline</h3>
        {isPending && !isStreaming && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Pending
          </span>
        )}
        {isStreaming && (
          <span className="flex items-center gap-1.5 text-xs text-violet-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            Running
          </span>
        )}
        {!isStreaming && allDone && (
          <span className="text-xs text-emerald-600 font-medium">Complete</span>
        )}
      </div>

      {/* Connecting the 4 stage cards with arrows */}
      {events.length === 0 && isStreaming ? (
        <div className="flex items-center gap-2 py-3 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
          Connecting to agent stream…
        </div>
      ) : events.length === 0 && isPending ? (
        <div className="flex items-stretch gap-2">
          {STAGES.map((stage, i) => (
            <div key={stage.id} className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <StageCard stage={stage} state="idle" tool={null} isStreaming={false} />
              </div>
              {i < STAGES.length - 1 && (
                <span className="text-slate-300 text-lg flex-shrink-0 select-none">›</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-stretch gap-2">
          {STAGES.map((stage, i) => {
            const state = getState(stage.role, events);
            const tool  = state === "active" ? getActiveTool(stage.role, events) : null;
            return (
              <div key={stage.id} className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <StageCard
                    stage={stage}
                    state={state}
                    tool={tool}
                    isStreaming={isStreaming}
                  />
                </div>
                {i < STAGES.length - 1 && (
                  <span className="text-slate-300 text-lg flex-shrink-0 select-none">›</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Result banner */}
      {(allDone || crewFailed) && (
        <div className={cn(
          "mt-4 pt-4 border-t border-slate-100 flex items-center gap-3 p-3 rounded-lg",
          allDone ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"
        )}>
          {allDone ? (
            <>
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <p className="text-sm text-emerald-700 font-medium flex-1">Processing complete</p>
              {resolvedStem && (
                <Link
                  href={`/invoices/${resolvedStem}`}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md transition-colors"
                >
                  View Invoice →
                </Link>
              )}
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 flex-1">
                Processing warning{crewFailed?.error ? `: ${crewFailed.error}` : ""}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
