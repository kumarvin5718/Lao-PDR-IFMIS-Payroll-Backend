/** React Query hook: `useJobPoller` — data fetching and cache keys. */
import { useCallback } from "react";

import { apiClient } from "@/api/client";
import type { ApiEnvelope } from "@/types/auth";

export type ReportJobResult = { file_path: string; rows?: number };

export type JobStatusPayload = {
  state: string;
  result?: ReportJobResult | null;
  error?: string | null;
};

/**
 * Poll GET /api/v1/reports/jobs/{job_id} until SUCCESS or FAILURE (Celery async exports).
 */
export function useJobPoller() {
  const pollJob = useCallback(
    async (
      jobId: string,
      onSuccess: (result: ReportJobResult) => void | Promise<void>,
      options?: { maxMs?: number; intervalMs?: number },
    ): Promise<void> => {
      const maxMs = options?.maxMs ?? 180_000;
      const intervalMs = options?.intervalMs ?? 1000;
      let waited = 0;

      while (waited < maxMs) {
        const { data } = await apiClient.get<ApiEnvelope<JobStatusPayload>>(
          `/api/v1/reports/jobs/${encodeURIComponent(jobId)}`,
        );
        if (!data.success || data.data === null) {
          throw new Error("job_poll_failed");
        }
        const d = data.data;
        if (d.state === "SUCCESS" && d.result?.file_path) {
          await onSuccess(d.result);
          return;
        }
        if (d.state === "FAILURE" || d.error) {
          throw new Error(d.error || "export_failed");
        }
        await new Promise((r) => setTimeout(r, intervalMs));
        waited += intervalMs;
      }
      throw new Error("export_timeout");
    },
    [],
  );

  return { pollJob };
}
