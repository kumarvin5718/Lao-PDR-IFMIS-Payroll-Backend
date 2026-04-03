import { apiClient } from "./client";

export async function getReport(path: string, params?: Record<string, unknown>) {
  const { data } = await apiClient.get(`/api/v1/reports/${path}`, { params });
  return data;
}

export async function getReportJob(jobId: string) {
  const { data } = await apiClient.get(`/api/v1/reports/jobs/${jobId}`);
  return data;
}
