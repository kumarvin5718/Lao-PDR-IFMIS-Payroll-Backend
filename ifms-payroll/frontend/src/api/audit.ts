/** API layer: `audit` — typed calls to backend `/api/v1`. */
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client";
import type { ApiEnvelope, PaginatedEnvelope } from "@/types/auth";

export interface AuditLogRow {
  id: number;
  table_name: string;
  row_key: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_at: string;
  circular_ref: string | null;
  change_remarks: string | null;
}

export interface AuditLogParams {
  table?: string;
  from?: string;
  to?: string;
  changed_by?: string;
  circular_ref?: string;
  page?: number;
  limit?: number;
}

export function useAuditLog(params: AuditLogParams) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 100;

  return useQuery({
    queryKey: ["audit-log", params] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedEnvelope<AuditLogRow[]>>("/api/v1/reports/audit-log", {
        params: {
          table: params.table,
          from: params.from,
          to: params.to,
          changed_by: params.changed_by,
          circular_ref: params.circular_ref,
          page,
          limit,
        },
      });
      if (!data.success || data.data === null) {
        throw new Error("Failed to load audit log");
      }
      return data;
    },
    staleTime: 30_000,
  });
}

export async function exportAuditLog(params: AuditLogParams): Promise<{ job_id: string }> {
  const { data } = await apiClient.get<ApiEnvelope<{ job_id: string }>>("/api/v1/reports/audit-log", {
    params: {
      table: params.table,
      from: params.from,
      to: params.to,
      changed_by: params.changed_by,
      circular_ref: params.circular_ref,
      page: params.page ?? 1,
      limit: params.limit ?? 100,
      export: "xlsx",
    },
  });
  if (!data.success || !data.data?.job_id) {
    throw new Error("Audit export failed");
  }
  return data.data;
}
