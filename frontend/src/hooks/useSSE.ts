"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/auth";
import { SSEEvent } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SESSION_KEY = "invoice_sse_session";

export function useSSE() {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const s: { events: SSEEvent[]; isDone: boolean } = JSON.parse(raw);
        if (s.events?.length) setEvents(s.events);
        if (s.isDone) setIsDone(true);
      }
    } catch {}
  }, []);

  // Persist to sessionStorage whenever events or isDone changes
  useEffect(() => {
    if (events.length === 0 && !isDone) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ events, isDone }));
    } catch {}
  }, [events, isDone]);

  const start = useCallback(async (streamUrl: string) => {
    setEvents([]);
    setIsDone(false);
    setIsStreaming(true);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}

    const token = getToken();
    const url = `${API_BASE}${streamUrl}${token ? `?token=${token}` : ""}`;

    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok || !res.body) {
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const raw = line.slice(5).trim();
            if (!raw) continue;
            try {
              const evt: SSEEvent = JSON.parse(raw);
              if (evt.type === "done") {
                setIsDone(true);
                setIsStreaming(false);
                return;
              }
              setEvents((prev) => [...prev, evt]);
            } catch {
              // skip malformed lines
            }
          }
        }
      }
    } catch {
      // connection closed or error
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const stop = useCallback(() => {
    readerRef.current?.cancel();
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    setEvents([]);
    setIsDone(false);
    setIsStreaming(false);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  }, []);

  return { events, isStreaming, isDone, start, stop, reset };
}
