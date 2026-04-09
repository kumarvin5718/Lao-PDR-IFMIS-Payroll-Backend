/** API layer: `dashboard` — typed calls to backend `/api/v1`. */
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";

export interface DashboardSummary {
  total_employees: number;
  complete_employees: number;
  fill_rate_pct: number;
  pending_registrations: number;
  gross_payroll_current: number;
  net_payroll_current: number;
}

export interface FillRateRow {
  department_name: string;
  complete: number;
  incomplete: number;
}

export interface GradeDistRow {
  grade: number;
  count: number;
}

export interface EmploymentMixRow {
  employment_type: string;
  count: number;
}

export interface PayrollTrendRow {
  month: string;
  gross: number;
  net: number;
  headcount: number;
}

export interface ScopeStats {
  total: number;
  complete: number;
  incomplete: number;
  fill_rate_pct: number;
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiFetch<DashboardSummary>("/dashboard/summary"),
    staleTime: 60_000,
  });
}

export function useDeptStats(dept: string | null) {
  return useQuery({
    queryKey: ["dashboard-dept-stats", dept],
    queryFn: () => apiFetch<ScopeStats>(`/dashboard/dept-stats?dept=${encodeURIComponent(dept!)}`),
    enabled: !!dept,
    staleTime: 60_000,
  });
}

export function useLocationStats(location: string | null) {
  return useQuery({
    queryKey: ["dashboard-location-stats", location],
    queryFn: () =>
      apiFetch<ScopeStats>(`/dashboard/location-stats?location=${encodeURIComponent(location!)}`),
    enabled: !!location,
    staleTime: 60_000,
  });
}

export function useManagerStats(managerUserId: string | null) {
  return useQuery({
    queryKey: ["dashboard-manager-stats", managerUserId],
    queryFn: () =>
      apiFetch<ScopeStats>(
        `/dashboard/manager-stats?manager_user_id=${encodeURIComponent(managerUserId!)}`,
      ),
    enabled: !!managerUserId,
    staleTime: 60_000,
  });
}

export function useFillRate() {
  return useQuery({
    queryKey: ["dashboard-fill-rate"],
    queryFn: () => apiFetch<{ data: FillRateRow[] }>("/dashboard/fill-rate"),
    staleTime: 60_000,
  });
}

export function useGradeDist() {
  return useQuery({
    queryKey: ["dashboard-grade-dist"],
    queryFn: () => apiFetch<{ data: GradeDistRow[] }>("/dashboard/grade-dist"),
    staleTime: 60_000,
  });
}

export function useEmploymentMix() {
  return useQuery({
    queryKey: ["dashboard-employment-mix"],
    queryFn: () => apiFetch<{ data: EmploymentMixRow[] }>("/dashboard/employment-mix"),
    staleTime: 60_000,
  });
}

export function usePayrollTrend(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["dashboard-payroll-trend"],
    queryFn: () => apiFetch<{ data: PayrollTrendRow[] }>("/dashboard/payroll-trend"),
    staleTime: 60_000,
    enabled: options?.enabled === true,
  });
}
