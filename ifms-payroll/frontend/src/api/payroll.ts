/** API layer: `payroll` — typed calls to backend `/api/v1`. */
import { apiClient } from "@/api/client";
import type { ApiEnvelope, PaginatedEnvelope } from "@/types/auth";

export interface PayrollMonthlyRow {
  employee_code: string;
  payroll_month: string;
  grade: number;
  step: number;
  basic_salary: number;
  allowance_position: number;
  allowance_technical: number;
  allowance_remote: number;
  allowance_hazardous: number;
  allowance_foreign: number;
  allowance_spouse: number;
  allowance_children: number;
  allowance_teaching: number;
  allowance_medical: number;
  allowance_na: number;
  allowance_housing: number;
  allowance_transport: number;
  free_allowance_1: number;
  free_allowance_2: number;
  free_allowance_3: number;
  gross_salary: number;
  employee_sso: number;
  employer_sso: number;
  taxable_income: number;
  pit_amount: number;
  free_deduction_1: number;
  free_deduction_2: number;
  net_salary: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  locked_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  full_name: string | null;
  ministry_name: string | null;
}

export interface PayrollSummary {
  month: string;
  total_gross: number;
  total_net: number;
  total_sso: number;
  total_pit: number;
  employee_count: number;
}

/** Async mode: job queued; poll `fetchPayrollRunJob` until SUCCESS/FAILURE. */
export type PayrollRunQueued = {
  job_id: string;
  status: "QUEUED";
  month: string;
  ministry_filter: string | null;
};

/** Sync mode (`PAYROLL_RUN_SYNC` on API): completed in request. */
export type PayrollRunCompleted = {
  job_id: null;
  status: "COMPLETED";
  month: string;
  processed: number;
  ministry_filter: string | null;
};

export type PayrollRunResponse = PayrollRunQueued | PayrollRunCompleted;

export async function runPayroll(
  month: string,
  ministry_filter?: string,
): Promise<ApiEnvelope<PayrollRunResponse>> {
  const { data } = await apiClient.post<ApiEnvelope<PayrollRunResponse>>("/api/v1/payroll/run", {
    month,
    ministry_filter: ministry_filter ?? null,
  });
  return data;
}

export type PayrollRunJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILURE"
  | "PENDING"
  | string;

export type PayrollRunJobPayload = {
  job_id: string;
  status: PayrollRunJobStatus;
  result: { month: string; processed: number; ministry_filter: string | null } | null;
  error: { code?: string; message?: string } | Record<string, unknown> | null;
};

export async function fetchPayrollRunJob(jobId: string): Promise<ApiEnvelope<PayrollRunJobPayload>> {
  const { data } = await apiClient.get<ApiEnvelope<PayrollRunJobPayload>>(
    `/api/v1/payroll/run/jobs/${encodeURIComponent(jobId)}`,
  );
  return data;
}

/** Poll until SUCCESS or FAILURE (2s interval, ~5 min max). */
export async function waitForPayrollRunJob(
  jobId: string,
  options?: {
    intervalMs?: number;
    maxAttempts?: number;
    /** Called after each status fetch (for UI: queued vs running). */
    onPoll?: (payload: PayrollRunJobPayload) => void;
  },
): Promise<PayrollRunJobPayload> {
  const intervalMs = options?.intervalMs ?? 2000;
  const maxAttempts = options?.maxAttempts ?? 150;
  const onPoll = options?.onPoll;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetchPayrollRunJob(jobId);
    if (!res.success || res.data === null) {
      throw new Error(res.error?.message ?? "job_status");
    }
    onPoll?.(res.data);
    const st = res.data.status;
    if (st === "SUCCESS" || st === "FAILURE") {
      return res.data;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("payroll_job_timeout");
}

export async function fetchPayroll(params: {
  month?: string;
  ministry?: string;
  page?: number;
  limit?: number;
  status?: string;
}): Promise<PaginatedEnvelope<PayrollMonthlyRow[]>> {
  const { data } = await apiClient.get<PaginatedEnvelope<PayrollMonthlyRow[]>>("/api/v1/payroll/monthly", {
    params,
  });
  return data;
}

/** Alias for hooks that expect this name. */
export const listMonthlyPayroll = fetchPayroll;

export async function patchFreeFields(
  code: string,
  month: string,
  body: {
    free_allowance_1?: number;
    free_allowance_2?: number;
    free_allowance_3?: number;
    free_deduction_1?: number;
    free_deduction_2?: number;
  },
): Promise<ApiEnvelope<PayrollMonthlyRow>> {
  const { data } = await apiClient.patch<ApiEnvelope<PayrollMonthlyRow>>(
    `/api/v1/payroll/monthly/${encodeURIComponent(code)}/${encodeURIComponent(month)}`,
    body,
  );
  return data;
}

export async function approvePayroll(
  month: string,
  ministry?: string,
  employee_code?: string,
): Promise<ApiEnvelope<{ month: string; approved_rows: number }>> {
  const { data } = await apiClient.post<ApiEnvelope<{ month: string; approved_rows: number }>>(
    "/api/v1/payroll/approve",
    { month, ministry: ministry ?? null, employee_code: employee_code ?? null },
  );
  return data;
}

export async function lockPayroll(month: string): Promise<ApiEnvelope<{ month: string; locked_rows: number }>> {
  const { data } = await apiClient.post<ApiEnvelope<{ month: string; locked_rows: number }>>(
    "/api/v1/payroll/lock",
    { month },
  );
  return data;
}

export async function unlockPayroll(
  month: string,
  reason: string,
): Promise<ApiEnvelope<{ month: string; unlocked_rows: number; reason: string }>> {
  const { data } = await apiClient.post<ApiEnvelope<{ month: string; unlocked_rows: number; reason: string }>>(
    "/api/v1/payroll/unlock",
    { month, reason },
  );
  return data;
}
