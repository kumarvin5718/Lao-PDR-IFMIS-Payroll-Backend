/** API layer: `admin` — typed calls to backend `/api/v1`. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/api/client";
import type { ApiEnvelope, PaginatedEnvelope } from "@/types/auth";

export type AppRole =
  | "ROLE_EMPLOYEE"
  | "ROLE_MANAGER"
  | "ROLE_DEPT_OFFICER"
  | "ROLE_ADMIN";

/** Matches GET /admin/users rows (backend `UserListItem`). */
export interface UserListItem {
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  /** Server returns `ROLE_*`; typed as string for JSON safety. */
  role: string;
  preferred_language: string;
  is_active: boolean;
  last_login: string | null;
}

export interface UserOut extends UserListItem {
  force_password_change: boolean;
}

/** Matches GET /admin/users/{id}/login-history (backend `AppLoginHistory`). */
export interface LoginHistoryItem {
  id: number;
  login_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface UserCreatePayload {
  username: string;
  full_name: string;
  email: string;
  role: AppRole;
  preferred_language?: string;
}

export interface UserUpdatePayload {
  role?: AppRole;
  is_active?: boolean;
  preferred_language?: string;
}

export interface CreateUserResponse {
  user: UserOut;
  temp_password: string;
  message: string;
}

export function useUsers(page = 1, limit = 50) {
  return useQuery({
    queryKey: ["admin-users", page, limit] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedEnvelope<UserListItem[]>>("/api/v1/admin/users", {
        params: { page, limit },
      });
      if (!data.success || data.data === null) {
        throw new Error("Failed to load users");
      }
      return data;
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UserCreatePayload) => {
      const { data } = await apiClient.post<ApiEnvelope<CreateUserResponse>>("/api/v1/admin/users", payload);
      if (!data.success || data.data === null) {
        throw new Error("Failed to create user");
      }
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export function useUpdateUser(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UserUpdatePayload) => {
      const { data } = await apiClient.put<ApiEnvelope<UserOut>>(
        `/api/v1/admin/users/${encodeURIComponent(userId)}`,
        payload,
      );
      if (!data.success || data.data === null) {
        throw new Error("Failed to update user");
      }
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

/** Update any user by id (e.g. edit drawer where the target user changes). */
export function useUpdateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, payload }: { userId: string; payload: UserUpdatePayload }) => {
      const { data } = await apiClient.put<ApiEnvelope<UserOut>>(
        `/api/v1/admin/users/${encodeURIComponent(userId)}`,
        payload,
      );
      if (!data.success || data.data === null) {
        throw new Error("Failed to update user");
      }
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (uid: string) => {
      const { data } = await apiClient.post<ApiEnvelope<{ temp_password: string; message: string }>>(
        `/api/v1/admin/users/${encodeURIComponent(uid)}/reset-password`,
      );
      if (!data.success || data.data === null) {
        throw new Error("Failed to reset password");
      }
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export function useLoginHistory(userId: string | null) {
  return useQuery({
    queryKey: ["admin-users", "login-history", userId] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<LoginHistoryItem[]>>(
        `/api/v1/admin/users/${encodeURIComponent(userId!)}/login-history`,
      );
      if (!data.success || data.data === null) {
        throw new Error("Failed to load login history");
      }
      return data.data;
    },
    enabled: Boolean(userId),
  });
}

/** Imperative fetch (no React Query). */
export async function fetchUsers(page = 1, limit = 50): Promise<PaginatedEnvelope<UserListItem[]>> {
  const { data } = await apiClient.get<PaginatedEnvelope<UserListItem[]>>("/api/v1/admin/users", {
    params: { page, limit },
  });
  return data;
}

export async function createUserRequest(payload: UserCreatePayload): Promise<CreateUserResponse> {
  const { data } = await apiClient.post<ApiEnvelope<CreateUserResponse>>("/api/v1/admin/users", payload);
  if (!data.success || !data.data) throw new Error("create failed");
  return data.data;
}

export async function updateUserRequest(userId: string, payload: UserUpdatePayload): Promise<UserOut> {
  const { data } = await apiClient.put<ApiEnvelope<UserOut>>(
    `/api/v1/admin/users/${encodeURIComponent(userId)}`,
    payload,
  );
  if (!data.success || !data.data) throw new Error("update failed");
  return data.data;
}

export async function getUserLoginHistory(userId: string): Promise<LoginHistoryItem[]> {
  const { data } = await apiClient.get<ApiEnvelope<LoginHistoryItem[]>>(
    `/api/v1/admin/users/${encodeURIComponent(userId)}/login-history`,
  );
  if (!data.success || data.data === null) throw new Error("login history failed");
  return data.data;
}

export async function getSystemJobs(): Promise<unknown> {
  const { data } = await apiClient.get("/api/v1/admin/system-jobs");
  return data;
}

/** GET /admin/registrations row (pending). */
export interface RegistrationRow {
  user_id: string;
  full_name: string;
  email: string;
  sso_number: string | null;
  location: string;
  department_name: string;
  submitted_at: string | null;
  registration_status: string;
}

export function useRegistrations(page = 1, limit = 100) {
  return useQuery({
    queryKey: ["admin-registrations", page, limit] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedEnvelope<RegistrationRow[]>>("/api/v1/admin/registrations", {
        params: { page, limit },
      });
      if (!data.success || data.data === null) {
        throw new Error("Failed to load registrations");
      }
      return data;
    },
  });
}

export function useApproveRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await apiClient.post<ApiEnvelope<{ message: string; temp_password: string }>>(
        `/api/v1/admin/registrations/${encodeURIComponent(userId)}/approve`,
      );
      if (!data.success || data.data === null) {
        throw new Error("Approve failed");
      }
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-registrations"] });
    },
  });
}

export function useRejectRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const { data } = await apiClient.post<ApiEnvelope<{ message: string }>>(
        `/api/v1/admin/registrations/${encodeURIComponent(userId)}/reject`,
        reason !== undefined && reason !== "" ? { reason } : {},
      );
      if (!data.success) {
        throw new Error("Reject failed");
      }
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-registrations"] });
    },
  });
}
