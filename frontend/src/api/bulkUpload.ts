import { apiClient } from "./client";

export async function downloadEmployeeTemplate() {
  const { data } = await apiClient.get("/api/v1/bulk-upload/employee/template", {
    responseType: "blob",
  });
  return data;
}

export async function validateEmployeeUpload(formData: FormData) {
  const { data } = await apiClient.post("/api/v1/bulk-upload/employee/validate", formData);
  return data;
}

export async function downloadEmployeeErrorReport(sessionId: string) {
  const { data } = await apiClient.get(`/api/v1/bulk-upload/employee/error-report/${sessionId}`, {
    responseType: "blob",
  });
  return data;
}

export async function confirmEmployeeUpload(body: unknown) {
  const { data } = await apiClient.post("/api/v1/bulk-upload/employee/confirm", body);
  return data;
}

export async function downloadPayrollFreeFieldsTemplate(params: Record<string, unknown>) {
  const { data } = await apiClient.get("/api/v1/bulk-upload/payroll-free-fields/template", {
    params,
    responseType: "blob",
  });
  return data;
}

export async function validatePayrollFreeFields(body: unknown) {
  const { data } = await apiClient.post("/api/v1/bulk-upload/payroll-free-fields/validate", body);
  return data;
}

export async function confirmPayrollFreeFields(body: unknown) {
  const { data } = await apiClient.post("/api/v1/bulk-upload/payroll-free-fields/confirm", body);
  return data;
}
