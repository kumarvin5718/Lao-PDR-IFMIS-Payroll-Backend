import { apiClient } from "./client";
import type { ApiEnvelope } from "@/types/auth";

/** Guest JWT for Superset embedded dashboard (from payroll API → Superset). */
export async function getGuestToken(dashboardId: string): Promise<string> {
  const { data } = await apiClient.get<ApiEnvelope<{ token: string }>>("/api/v1/superset/guest-token", {
    params: { dashboard_id: dashboardId },
  });
  if (!data.success || !data.data?.token) {
    throw new Error(data.error?.message ?? "Guest token request failed");
  }
  return data.data.token;
}
