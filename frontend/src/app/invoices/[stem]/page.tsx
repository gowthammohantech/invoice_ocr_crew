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
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Invoices
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 font-mono">{stem}</h1>
          {isLoading ? (
            <Skeleton className="h-5 w-16" />
          ) : invoice ? (
            <Badge
              variant="outline"
              className={
                passed === true
                  ? "border-emerald-200 text-emerald-700 bg-emerald-50 gap-1"
                  : passed === false
                  ? "border-red-200 text-red-700 bg-red-50 gap-1"
                  : "border-slate-200 text-slate-500 bg-slate-50"
              }
            >
              {passed === true ? <CheckCircle className="w-3 h-3" /> : passed === false ? <XCircle className="w-3 h-3" /> : null}
              {passed === true ? "passed" : passed === false ? "failed" : "unknown"}
            </Badge>
          ) : null}
        </div>
        {invoice?.vendor_name && (
          <p className="text-slate-500 text-sm mt-1">
            {invoice.vendor_name} — {invoice.invoice_number}
          </p>
        )}
      </div>

      <Tabs defaultValue="ocr" className="space-y-4">
        <TabsList className="bg-slate-100 border border-slate-200 p-1 rounded-lg">
          {[
            { value: "ocr", label: "OCR Text" },
            { value: "json", label: "Extracted Data" },
            { value: "validation", label: "Validation" },
            { value: "reference", label: "Reference Image" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-sm data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm text-slate-500 rounded-md px-4 py-1.5"
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
