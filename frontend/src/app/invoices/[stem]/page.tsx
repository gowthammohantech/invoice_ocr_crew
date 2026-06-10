"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvoiceDetail } from "@/hooks/useInvoices";
import OcrTextTab from "@/components/invoice-detail/OcrTextTab";
import ExtractedJsonTab from "@/components/invoice-detail/ExtractedJsonTab";
import ValidationTab from "@/components/invoice-detail/ValidationTab";
import ReferenceImageTab from "@/components/invoice-detail/ReferenceImageTab";

export default function InvoiceDetailPage() {
  const { stem } = useParams<{ stem: string }>();
  const { invoice, isLoading } = useInvoiceDetail(stem);

  const passed = invoice?.validation?.passed;

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/invoices" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 text-sm mb-4 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Invoices
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-white font-mono">{stem}</h1>
          {isLoading ? (
            <Skeleton className="h-5 w-16 bg-white/[0.05]" />
          ) : invoice ? (
            <Badge
              variant="outline"
              className={
                passed === true
                  ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 gap-1"
                  : passed === false
                  ? "border-red-500/30 text-red-400 bg-red-500/10 gap-1"
                  : "border-zinc-500/30 text-zinc-400 bg-zinc-500/10"
              }
            >
              {passed === true ? <CheckCircle className="w-3 h-3" /> : passed === false ? <XCircle className="w-3 h-3" /> : null}
              {passed === true ? "passed" : passed === false ? "failed" : "unknown"}
            </Badge>
          ) : null}
        </div>
        {invoice?.vendor_name && (
          <p className="text-zinc-500 text-sm mt-1">{invoice.vendor_name} — {invoice.invoice_number}</p>
        )}
      </div>

      <Tabs defaultValue="ocr" className="space-y-4">
        <TabsList className="bg-[#111] border border-white/[0.07] p-1 rounded-lg">
          {[
            { value: "ocr", label: "OCR Text" },
            { value: "json", label: "Extracted Data" },
            { value: "validation", label: "Validation" },
            { value: "reference", label: "Reference Image" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-sm data-[state=active]:bg-violet-600/20 data-[state=active]:text-violet-300 data-[state=active]:border-violet-500/30 data-[state=active]:border text-zinc-500 rounded-md px-4 py-1.5"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="ocr"><OcrTextTab stem={stem} /></TabsContent>
        <TabsContent value="json"><ExtractedJsonTab stem={stem} /></TabsContent>
        <TabsContent value="validation"><ValidationTab stem={stem} /></TabsContent>
        <TabsContent value="reference"><ReferenceImageTab stem={stem} /></TabsContent>
      </Tabs>
    </div>
  );
}
