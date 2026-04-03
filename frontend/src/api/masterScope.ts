import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/api/client";
import type { ApiEnvelope } from "@/types/auth";

export interface ManagerScopeRow {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  location: string;
  department_name: string;
  is_active: boolean;
  created_at: string | null;
}

export interface MyManagerScopeRow {
  id: string;
  location: string;
  department_name: string;
  is_active: boolean;
}

export interface DeptOfficerScopeRow {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  department_name: string;
  is_active: boolean;
  created_at: string | null;
}

export interface UserByRoleRow {
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

export function useManagerScopes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["master", "manager-scope"] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<ManagerScopeRow[]>>("/api/v1/master/manager-scope");
      if (!data.success || data.data === null) throw new Error("manager-scope");
      return data.data;
    },
    enabled: options?.enabled !== false,
  });
}

export function useCreateManagerScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { user_id: string; location: string; department_name: string }) => {
      const { data } = await apiClient.post<ApiEnvelope<ManagerScopeRow>>(
        "/api/v1/master/manager-scope",
        payload,
      );
      if (!data.success || data.data === null) throw new Error("create manager scope");
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["master", "manager-scope"] });
    },
  });
}

export function useDeleteManagerScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiEnvelope<{ message: string }>>(
        `/api/v1/master/manager-scope/${encodeURIComponent(id)}`,
      );
      if (!data.success) throw new Error("delete manager scope");
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["master", "manager-scope"] });
    },
  });
}

export function useUsersByRole(role: "ROLE_MANAGER" | "ROLE_DEPT_OFFICER") {
  return useQuery({
    queryKey: ["admin", "users-by-role", role] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<UserByRoleRow[]>>("/api/v1/admin/users-by-role", {
        params: { role },
      });
      if (!data.success || data.data === null) throw new Error("users-by-role");
      return data.data;
    },
  });
}

export function useDeptOfficerScopes() {
  return useQuery({
    queryKey: ["master", "dept-officer-scope"] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<DeptOfficerScopeRow[]>>(
        "/api/v1/master/dept-officer-scope",
      );
      if (!data.success || data.data === null) throw new Error("dept-officer-scope");
      return data.data;
    },
  });
}

export function useCreateDeptOfficerScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { user_id: string; department_name: string }) => {
      const { data } = await apiClient.post<ApiEnvelope<DeptOfficerScopeRow>>(
        "/api/v1/master/dept-officer-scope",
        payload,
      );
      if (!data.success || data.data === null) throw new Error("create dept officer scope");
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["master", "dept-officer-scope"] });
    },
  });
}

export function useDeleteDeptOfficerScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiEnvelope<{ message: string }>>(
        `/api/v1/master/dept-officer-scope/${encodeURIComponent(id)}`,
      );
      if (!data.success) throw new Error("delete dept officer scope");
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["master", "dept-officer-scope"] });
    },
  });
}

export interface MasterEmployeeCounts {
  by_department: Record<string, number>;
  by_province: Record<string, number>;
  by_manager_scope: Record<string, number>;
}

export function useEmployeeCounts(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["master-employee-counts"] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<MasterEmployeeCounts>>("/api/v1/master/employee-counts");
      if (!data.success || data.data === null) throw new Error("employee-counts");
      return data.data;
    },
    staleTime: 300_000,
    enabled: options?.enabled !== false,
  });
}
