"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useRawText } from "@/hooks/useInvoices";

export default function OcrTextTab({ stem }: { stem: string }) {
  const { text, isLoading, error } = useRawText(stem);

  if (isLoading) return <Skeleton className="h-64 rounded-lg" />;
  if (error) return <p className="text-red-600 text-sm">Failed to load OCR text.</p>;
  if (!text) return <p className="text-slate-400 text-sm">No OCR text available.</p>;

  return (
    <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 font-mono overflow-auto max-h-[60vh] whitespace-pre-wrap leading-relaxed">
      {text}
    </pre>
  );
}
