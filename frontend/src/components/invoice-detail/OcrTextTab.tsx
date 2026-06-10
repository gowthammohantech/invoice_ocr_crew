"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useRawText } from "@/hooks/useInvoices";

export default function OcrTextTab({ stem }: { stem: string }) {
  const { text, isLoading, error } = useRawText(stem);

  if (isLoading) return <Skeleton className="h-64 bg-white/[0.05] rounded-lg" />;
  if (error) return <p className="text-red-400 text-sm">Failed to load OCR text.</p>;
  if (!text) return <p className="text-zinc-600 text-sm">No OCR text available.</p>;

  return (
    <pre className="bg-[#0d0d0d] border border-white/[0.07] rounded-lg p-4 text-xs text-zinc-300 font-mono overflow-auto max-h-[60vh] whitespace-pre-wrap leading-relaxed">
      {text}
    </pre>
  );
}
