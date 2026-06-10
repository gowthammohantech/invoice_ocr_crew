"use client";

import Link from "next/link";
import { CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInvoiceList } from "@/hooks/useInvoices";

export default function InvoicesPage() {
  const { invoices, total, isLoading } = useInvoiceList();

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isLoading ? "Loading..." : `${total} invoice${total !== 1 ? "s" : ""} processed`}
          </p>
        </div>
        <Link
          href="/process"
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Process New
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 hover:bg-transparent bg-slate-50">
              <TableHead className="text-slate-500 font-medium text-xs uppercase tracking-wider">Filename</TableHead>
              <TableHead className="text-slate-500 font-medium text-xs uppercase tracking-wider">Stem</TableHead>
              <TableHead className="text-slate-500 font-medium text-xs uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-slate-500 font-medium text-xs uppercase tracking-wider w-20">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <TableRow key={i} className="border-slate-100">
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                </TableRow>
              ))
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-400 py-12">
                  No invoices processed yet.{" "}
                  <Link href="/process" className="text-violet-600 hover:underline">Process one now.</Link>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.stem} className="border-slate-100 hover:bg-slate-50 transition-colors">
                  <TableCell className="text-slate-800 font-mono text-sm">{inv.filename}</TableCell>
                  <TableCell className="text-slate-500 font-mono text-sm">{inv.stem}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        inv.status === "pass"
                          ? "border-emerald-200 text-emerald-700 bg-emerald-50 text-xs gap-1"
                          : "border-red-200 text-red-700 bg-red-50 text-xs gap-1"
                      }
                    >
                      {inv.status === "pass"
                        ? <CheckCircle className="w-3 h-3" />
                        : <XCircle className="w-3 h-3" />
                      }
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/invoices/${inv.stem}`}
                      className="inline-flex items-center gap-1 text-slate-400 hover:text-violet-600 text-sm transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
