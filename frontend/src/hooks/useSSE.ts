"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/auth";
import { SSEEvent } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SESSION_KEY = "invoice_sse_session";

export function useSSE() {
  const [events, setEvents]       = useState<SSEEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDone, setIsDone]       = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Restore persisted events on mount (for tab-switch resilience)
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

  // Persist whenever events/isDone change
  useEffect(() => {
    if (events.length === 0 && !isDone) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ events, isDone }));
    } catch {}
  }, [events, isDone]);

  /**
   * Connect to an SSE stream using the native EventSource API.
   * Each `onmessage` fires in its own event-loop turn, so React
   * re-renders between events — giving true real-time stage updates.
   */
  const start = useCallback((streamUrl: string) => {
    // Close any stale connection
    esRef.current?.close();
    esRef.current = null;

    setEvents([]);
    setIsDone(false);
    setIsStreaming(true);
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}

    const token = getToken();
    const url   = `${API_BASE}${streamUrl}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const evt: SSEEvent = JSON.parse(event.data);
        if (evt.type === "done") {
          setIsDone(true);
          setIsStreaming(false);
          es.close();
          esRef.current = null;
          return;
        }
        // One setState per event → one render per event
        setEvents((prev) => [...prev, evt]);
      } catch {}
    };

    es.onerror = () => {
      // EventSource would auto-reconnect; we close deliberately instead
      setIsStreaming(false);
      es.close();
      esRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setEvents([]);
    setIsDone(false);
    setIsStreaming(false);
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  }, []);

  return { events, isStreaming, isDone, start, stop, reset };
}
