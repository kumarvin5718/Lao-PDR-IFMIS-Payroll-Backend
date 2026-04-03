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

export async function runPayroll(
  month: string,
  ministry_filter?: string,
): Promise<ApiEnvelope<{ month: string; processed: number; ministry_filter: string | null }>> {
  const { data } = await apiClient.post<
    ApiEnvelope<{ month: string; processed: number; ministry_filter: string | null }>
  >("/api/v1/payroll/run", { month, ministry_filter: ministry_filter ?? null });
  return data;
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
