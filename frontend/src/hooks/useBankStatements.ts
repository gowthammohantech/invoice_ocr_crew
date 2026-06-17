import useSWR from "swr";
import api from "@/lib/api";
import { BankStatementDetail, BankStatementMeta, BankStatementSummary } from "@/lib/types";

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export function useBankStatementList() {
  const { data, error, isLoading, mutate } = useSWR<{
    statements: BankStatementSummary[];
    total: number;
  }>("/api/bank/statements", fetcher, { revalidateOnFocus: true });
  return { statements: data?.statements ?? [], total: data?.total ?? 0, error, isLoading, mutate };
}

export function useBankStatementDetail(stem: string | null) {
  const { data, error, isLoading } = useSWR<BankStatementDetail>(
    stem ? `/api/bank/statement/${stem}` : null,
    fetcher
  );
  return { statement: data, error, isLoading };
}

export function useBankStatementMeta(stem: string | null) {
  const { data, error, isLoading } = useSWR<BankStatementMeta>(
    stem ? `/api/bank/statement/${stem}/meta` : null,
    fetcher
  );
  return { meta: data, error, isLoading };
}

export function useBankRawText(stem: string | null) {
  const { data, error, isLoading } = useSWR<{ stem: string; text: string }>(
    stem ? `/api/bank/raw/${stem}` : null,
    fetcher
  );
  return { text: data?.text, error, isLoading };
}
