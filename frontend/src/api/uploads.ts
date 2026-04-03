import { apiClient } from "./client";

import type { ApiEnvelope } from "@/types/auth";

export interface RowResult {
  row_number: number;
  employee_code: string | null;
  status: "OK" | "WARN" | "ERROR";
  errors: string[];
  warnings: string[];
}

export interface ParseResult {
  session_id: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  warning_rows: number;
  can_commit: boolean;
  preview: RowResult[];
  all_rows: RowResult[];
}

export interface CommitResult {
  session_id: string;
  committed: number;
  skipped_duplicates: number;
  skipped_errors: number;
}

export async function downloadTemplate(): Promise<void> {
  const { data } = await apiClient.get("/api/v1/uploads/employees/template", {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "employee_upload_template.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseUpload(file: File): Promise<ApiEnvelope<ParseResult>> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<ApiEnvelope<ParseResult>>(
    "/api/v1/uploads/employees/parse",
    formData,
  );
  return data;
}

export async function commitUpload(sessionId: string): Promise<ApiEnvelope<CommitResult>> {
  const { data } = await apiClient.post<ApiEnvelope<CommitResult>>(
    `/api/v1/uploads/employees/commit/${sessionId}`,
  );
  return data;
}
