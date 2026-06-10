import useSWR from "swr";
import api from "@/lib/api";
import { InvoiceDetail, InvoiceSummary, TraceEntry } from "@/lib/types";

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export function useInvoiceList() {
  const { data, error, isLoading, mutate } = useSWR<{
    invoices: InvoiceSummary[];
    total: number;
  }>("/api/invoices", fetcher);
  return { invoices: data?.invoices ?? [], total: data?.total ?? 0, error, isLoading, mutate };
}

export function useInvoiceDetail(stem: string | null) {
  const { data, error, isLoading } = useSWR<InvoiceDetail>(
    stem ? `/api/invoice/${stem}` : null,
    fetcher
  );
  return { invoice: data, error, isLoading };
}

export function useRawText(stem: string | null) {
  const { data, error, isLoading } = useSWR<{ stem: string; text: string }>(
    stem ? `/api/raw/${stem}` : null,
    fetcher
  );
  return { text: data?.text, error, isLoading };
}

export function useTrace(stem: string | null) {
  const { data, error, isLoading } = useSWR(
    stem ? `/api/traces/${stem}` : null,
    fetcher
  );
  return { trace: data, error, isLoading };
}

export function useReferenceImages(stem: string | null) {
  const { data, error, isLoading } = useSWR<{ stem: string; images: string[] }>(
    stem ? `/api/reference/${stem}` : null,
    fetcher
  );
  return { images: data?.images ?? [], error, isLoading };
}

export function useLogs(limit = 100) {
  const { data, error, isLoading, mutate } = useSWR<{
    entries: TraceEntry[];
    total: number;
  }>(`/api/logs?limit=${limit}`, fetcher);
  return { entries: data?.entries ?? [], total: data?.total ?? 0, error, isLoading, mutate };
}
