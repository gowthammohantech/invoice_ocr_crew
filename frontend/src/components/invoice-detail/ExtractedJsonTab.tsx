"use client";

import { JsonView, allExpanded, defaultStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvoiceDetail } from "@/hooks/useInvoices";

export default function ExtractedJsonTab({ stem }: { stem: string }) {
  const { invoice, isLoading, error } = useInvoiceDetail(stem);

  if (isLoading) return <Skeleton className="h-64 bg-white/[0.05] rounded-lg" />;
  if (error) return <p className="text-red-400 text-sm">Failed to load invoice data.</p>;
  if (!invoice) return <p className="text-zinc-600 text-sm">No data available.</p>;

  // Exclude validation block from this view
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { validation, ...data } = invoice;

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.07] rounded-lg p-4 overflow-auto max-h-[60vh]">
      <JsonView
        data={data}
        shouldExpandNode={allExpanded}
        style={{
          ...defaultStyles,
          container: "font-mono text-xs leading-relaxed",
          basicChildStyle: "ml-4",
          label: "text-violet-300 mr-1",
          stringValue: "text-emerald-300",
          numberValue: "text-amber-300",
          booleanValue: "text-blue-300",
          nullValue: "text-zinc-500",
        }}
      />
    </div>
  );
}
