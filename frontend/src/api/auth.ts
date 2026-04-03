import { apiClient } from "./client";

export async function logout() {
  await apiClient.post("/api/v1/auth/logout");
}
