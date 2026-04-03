import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { ApiEnvelope } from "@/types/auth";

import { apiClient, apiFetch } from "./client";

export async function getMinistries() {
  const { data } = await apiClient.get("/api/v1/lookups/ministries");
  return data;
}

export async function getDepartments(params: Record<string, unknown>) {
  const { data } = await apiClient.get("/api/v1/lookups/departments", { params });
  return data;
}

export async function getDivisions(params: Record<string, unknown>) {
  const { data } = await apiClient.get("/api/v1/lookups/divisions", { params });
  return data;
}

export async function getOrgDerived(params: Record<string, unknown>) {
  const { data } = await apiClient.get("/api/v1/lookups/org-derived", { params });
  return data;
}

export async function getCountries() {
  const { data } = await apiClient.get("/api/v1/lookups/countries");
  return data;
}

export async function getProvinces(params: Record<string, unknown>) {
  const { data } = await apiClient.get("/api/v1/lookups/provinces", { params });
  return data;
}

export async function getDistricts(params: Record<string, unknown>) {
  const { data } = await apiClient.get("/api/v1/lookups/districts", { params });
  return data;
}

export async function getLocationDerived(params: Record<string, unknown>) {
  const { data } = await apiClient.get("/api/v1/lookups/location-derived", { params });
  return data;
}

export async function getBanks() {
  const { data } = await apiClient.get("/api/v1/lookups/banks");
  return data;
}

export async function getBranches(params: Record<string, unknown>) {
  const { data } = await apiClient.get("/api/v1/lookups/branches", { params });
  return data;
}

export async function getBankDerived(params: Record<string, unknown>) {
  const { data } = await apiClient.get("/api/v1/lookups/bank-derived", { params });
  return data;
}

export async function getGradeDerive(params: Record<string, unknown>) {
  const { data } = await apiClient.get("/api/v1/lookups/grade-derive", { params });
  return data;
}

export function useMinistries() {
  return useQuery({
    queryKey: ["ministries"] as const,
    queryFn: () => apiFetch<string[]>("/lookups/ministries"),
    staleTime: 300_000,
  });
}

export interface BranchOption {
  bank_name: string;
  branch_name: string;
}

export function useBanks() {
  return useQuery({
    queryKey: ["banks"] as const,
    queryFn: () => apiFetch<string[]>("/lookups/banks"),
    staleTime: 300_000,
  });
}

/** Branches for a bank; `bankName` is matched as bank_name (or bank_key) on the server. */
export function useBranches(bankName: string | null) {
  return useQuery({
    queryKey: ["branches", bankName] as const,
    queryFn: () =>
      apiFetch<string[]>(`/lookups/branches?bank_key=${encodeURIComponent(bankName!)}`),
    enabled: !!bankName,
    staleTime: 300_000,
  });
}

/** All (bank_name, branch_name) pairs from bank master (no bank_key query). */
export function useAllBranches() {
  return useQuery({
    queryKey: ["all-branches"] as const,
    queryFn: () => apiFetch<BranchOption[]>("/lookups/branches"),
    staleTime: 300_000,
  });
}

export function useProvinces() {
  return useQuery({
    queryKey: ["lookups", "provinces"] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<string[]>>("/api/v1/lookups/provinces");
      if (!data.success || data.data === null) return [];
      return data.data;
    },
    staleTime: 60_000,
  });
}

/** No args: all departments. With location: departments for that province (fetch runs only when location is truthy). */
export function useDepartments(): UseQueryResult<string[], Error>;
export function useDepartments(location: string | undefined): UseQueryResult<string[], Error>;
export function useDepartments(location?: string | undefined): UseQueryResult<string[], Error> {
  const hasArg = arguments.length > 0;
  return useQuery({
    queryKey: ["lookups", "departments", hasArg ? location ?? "" : "all"] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<string[]>>("/api/v1/lookups/departments", {
        params: hasArg && location ? { location } : {},
      });
      if (!data.success || data.data === null) return [];
      return data.data;
    },
    enabled: hasArg ? Boolean(location) : true,
    staleTime: 60_000,
  });
}
