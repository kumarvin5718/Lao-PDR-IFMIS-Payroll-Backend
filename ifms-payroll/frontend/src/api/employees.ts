/** API layer: `employees` — typed calls to backend `/api/v1`. */
import { apiClient } from "@/api/client";
import type { ApiEnvelope, PaginatedEnvelope } from "@/types/auth";

export type EmploymentType = "Permanent" | "Probationary" | "Contract" | "Intern";
export type Title = "Mr." | "Ms." | "Mrs." | "Dr." | "Prof.";
export type Gender = "Male" | "Female" | "Other";
export type FieldAllowanceType = "Teaching" | "Medical" | "None";

export interface EmployeeListItem {
  employee_code: string;
  email: string;
  full_name: string;
  ministry_name: string;
  grade: number;
  step: number;
  position_title: string;
  employment_type: EmploymentType | string;
  is_active: boolean;
  date_of_joining: string;
  owner_role?: string | null;
  uploaded_by_user_id?: string | null;
  service_province?: string | null;
  department_name?: string | null;
}

export interface EmployeeOut {
  employee_code: string;
  title: string;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  email: string;
  mobile_number: string | null;
  date_of_joining: string;
  employment_type: string;
  position_title: string;
  education_level: string;
  prior_experience_years: number;
  grade: number;
  step: number;
  civil_service_card_id: string;
  sso_number: string | null;
  ministry_name: string;
  department_name: string;
  division_name: string | null;
  service_country: string;
  service_province: string;
  service_district: string | null;
  profession_category: string;
  is_remote_area: boolean;
  is_foreign_posting: boolean;
  is_hazardous_area: boolean;
  house_no: string | null;
  street: string | null;
  area_baan: string | null;
  province_of_residence: string | null;
  pin_code: string | null;
  residence_country: string | null;
  bank_name: string;
  bank_branch: string;
  bank_branch_code: string | null;
  bank_account_no: string;
  swift_code: string | null;
  has_spouse: boolean;
  eligible_children: number;
  position_level: string;
  is_na_member: boolean;
  field_allowance_type: string;
  is_active: boolean;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
  full_name: string;
  years_of_service: number;
  date_of_retirement: string;
}

export interface EmployeeCreate {
  employee_code?: string | null;
  title: Title;
  first_name: string;
  last_name: string;
  gender: Gender;
  date_of_birth: string;
  email: string;
  mobile_number?: string | null;
  date_of_joining: string;
  employment_type: EmploymentType;
  position_title: string;
  education_level: string;
  prior_experience_years: number;
  grade: number;
  step: number;
  civil_service_card_id: string;
  sso_number?: string | null;
  ministry_name: string;
  department_name: string;
  division_name?: string | null;
  service_country: string;
  service_province: string;
  service_district?: string | null;
  profession_category: string;
  is_remote_area: boolean;
  is_foreign_posting: boolean;
  is_hazardous_area: boolean;
  house_no?: string | null;
  street?: string | null;
  area_baan?: string | null;
  province_of_residence?: string | null;
  pin_code?: string | null;
  residence_country?: string | null;
  bank_name: string;
  bank_branch: string;
  bank_branch_code?: string | null;
  bank_account_no: string;
  swift_code?: string | null;
  has_spouse: boolean;
  eligible_children: number;
  position_level: string;
  is_na_member: boolean;
  field_allowance_type: FieldAllowanceType;
  is_active: boolean;
}

export type EmployeeListParams = {
  page?: number;
  limit?: number;
  search?: string;
  ministry?: string;
  grade?: number;
  employment_type?: string;
  is_active?: boolean;
};

export type EmployeeExportParams = {
  format: "xlsx" | "pdf";
  search?: string;
  ministry?: string;
  grade?: number;
  province?: string;
  employment_type?: string;
  is_active?: boolean;
};

export type ExportJobResponse = { job_id: string; status: string };

export type BatchResultRow =
  | { row: number; status: "success"; employee_code: string }
  | { row: number; status: "error"; errors: { field: string; message: string }[] };

export type BatchCreateResponse = {
  imported: number;
  skipped: number;
  results: BatchResultRow[];
};

function cleanParams(p: EmployeeListParams): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (p.page !== undefined) out.page = p.page;
  if (p.limit !== undefined) out.limit = p.limit;
  if (p.search !== undefined && p.search !== "") out.search = p.search;
  if (p.ministry !== undefined && p.ministry !== "") out.ministry = p.ministry;
  if (p.grade !== undefined) out.grade = p.grade;
  if (p.employment_type !== undefined && p.employment_type !== "") out.employment_type = p.employment_type;
  if (p.is_active !== undefined) out.is_active = p.is_active;
  return out;
}

export async function fetchEmployees(
  params: EmployeeListParams,
): Promise<PaginatedEnvelope<EmployeeListItem[]>> {
  const { data } = await apiClient.get<PaginatedEnvelope<EmployeeListItem[]>>("/api/v1/employees", {
    params: cleanParams(params),
  });
  return data;
}

export async function fetchEmployee(code: string): Promise<ApiEnvelope<EmployeeOut>> {
  const { data } = await apiClient.get<ApiEnvelope<EmployeeOut>>(`/api/v1/employees/${encodeURIComponent(code)}`);
  return data;
}

export async function createEmployee(body: EmployeeCreate): Promise<ApiEnvelope<EmployeeOut>> {
  const { data } = await apiClient.post<ApiEnvelope<EmployeeOut>>("/api/v1/employees", body);
  return data;
}

export async function updateEmployee(
  code: string,
  body: Partial<EmployeeCreate>,
): Promise<ApiEnvelope<EmployeeOut>> {
  const { data } = await apiClient.put<ApiEnvelope<EmployeeOut>>(
    `/api/v1/employees/${encodeURIComponent(code)}`,
    body,
  );
  return data;
}

export async function deactivateEmployee(code: string): Promise<ApiEnvelope<EmployeeOut>> {
  const { data } = await apiClient.delete<ApiEnvelope<EmployeeOut>>(
    `/api/v1/employees/${encodeURIComponent(code)}`,
  );
  return data;
}

function exportQueryString(p: EmployeeExportParams): string {
  const q = new URLSearchParams();
  q.set("format", p.format);
  if (p.ministry) q.set("ministry", p.ministry);
  if (p.grade !== undefined && !Number.isNaN(p.grade)) q.set("grade", String(p.grade));
  if (p.province) q.set("province", p.province);
  if (p.employment_type) q.set("employment_type", p.employment_type);
  if (p.search) q.set("search", p.search);
  if (p.is_active !== undefined) q.set("is_active", String(p.is_active));
  return q.toString();
}

/** Returns JSON envelope with job_id (async) — caller uses blob request for sync file. */
export async function requestEmployeeExportJob(params: EmployeeExportParams): Promise<ApiEnvelope<ExportJobResponse>> {
  const { data } = await apiClient.get<ApiEnvelope<ExportJobResponse>>(
    `/api/v1/employees/export?${exportQueryString(params)}`,
  );
  return data;
}

/** GET export with blob; detects JSON job vs file body (Content-Type can be missing behind some proxies). */
export async function downloadEmployeeExport(
  params: EmployeeExportParams,
): Promise<{ kind: "job"; jobId: string } | { kind: "file"; blob: Blob; filename: string }> {
  const res = await apiClient.get(`/api/v1/employees/export?${exportQueryString(params)}`, {
    responseType: "blob",
    validateStatus: () => true,
  });
  const blob = res.data as Blob;
  const ct = String(res.headers["content-type"] ?? res.headers["Content-Type"] ?? "").toLowerCase();

  const tryParseJsonEnvelope = async (): Promise<ApiEnvelope<ExportJobResponse> | null> => {
    const text = await blob.text();
    const trimmed = text.trim();
    if (!trimmed.startsWith("{")) return null;
    try {
      return JSON.parse(trimmed) as ApiEnvelope<ExportJobResponse>;
    } catch {
      return null;
    }
  };

  if (res.status >= 400) {
    const parsed = await tryParseJsonEnvelope();
    const msg = parsed?.error?.message ?? `Export failed (${res.status})`;
    throw new Error(msg);
  }

  if (ct.includes("application/json")) {
    const text = await blob.text();
    const parsed = JSON.parse(text) as ApiEnvelope<ExportJobResponse>;
    if (!parsed.success || !parsed.data?.job_id) {
      throw new Error(parsed.error?.message ?? "export_job_failed");
    }
    return { kind: "job", jobId: parsed.data.job_id };
  }

  const peek = await blob.slice(0, 1).text();
  if (peek === "{") {
    const parsed = await tryParseJsonEnvelope();
    if (parsed?.success && parsed.data && "job_id" in parsed.data && parsed.data.job_id) {
      return { kind: "job", jobId: parsed.data.job_id };
    }
    if (parsed && !parsed.success) {
      throw new Error(parsed.error?.message ?? "export_failed");
    }
  }

  const dispo = String(res.headers["content-disposition"] || res.headers["Content-Disposition"] || "");
  const match = /filename="?([^";]+)"?/i.exec(dispo);
  const filename =
    match?.[1] ?? (params.format === "pdf" ? "employees_export.pdf" : "employees_export.xlsx");
  return { kind: "file", blob, filename };
}

export async function submitEmployeeBatch(
  employees: Record<string, unknown>[],
): Promise<ApiEnvelope<BatchCreateResponse>> {
  const { data } = await apiClient.post<ApiEnvelope<BatchCreateResponse>>("/api/v1/employees/batch", {
    employees,
  });
  return data;
}
