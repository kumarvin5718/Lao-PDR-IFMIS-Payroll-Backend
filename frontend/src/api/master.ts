import { apiClient } from "@/api/client";
import type { ApiEnvelope } from "@/types/auth";

export interface GradeStep {
  grade: number;
  step: number;
  basic_salary: number;
}

export interface AllowanceRate {
  allowance_name: string;
  rate_type: string;
  rate_value: number;
  effective_date: string | null;
}

export interface AllowanceRateCreate {
  allowance_name: string;
  rate_type: string;
  rate_value: number;
  effective_date: string | null;
}

export interface GradeDerivation {
  education_level: string;
  min_exp_years: number;
  derived_grade: number;
  derived_step: number;
}

export interface GradeDerivationCreate {
  education_level: string;
  min_exp_years: number;
  exp_max_years?: number | null;
  derived_grade: number;
  derived_step: number;
}

export interface OrgRow {
  ministry_name: string;
  dept_key: string;
  dept_display_name: string;
  is_active: boolean;
}

export interface OrgCreate {
  ministry_name: string;
  dept_key: string;
  dept_display_name: string;
  is_active: boolean;
}

export interface Location {
  province: string;
  region: string;
  is_remote_area: boolean;
  is_hazardous_area: boolean;
  /** Present on rows from GET /master/location; omitted when creating. */
  is_active?: boolean;
}

export interface Bank {
  bank_name: string;
  bank_code: string;
  swift_code: string | null;
  is_active: boolean;
}

export interface BankUpdate {
  swift_code?: string | null;
  is_active?: boolean;
}

export interface PITBracket {
  bracket_no: number;
  lower_bound: number;
  upper_bound: number | null;
  rate_pct: number;
  deduction_amount: number;
}

export interface DeriveResult {
  grade: number;
  step: number;
  derived: boolean;
}

export async function fetchGradeSteps(): Promise<ApiEnvelope<GradeStep[]>> {
  const { data } = await apiClient.get<ApiEnvelope<GradeStep[]>>("/api/v1/master/grade-step");
  return data;
}

export async function updateGradeStep(
  grade: number,
  step: number,
  body: { basic_salary: number },
): Promise<ApiEnvelope<GradeStep>> {
  const { data } = await apiClient.put<ApiEnvelope<GradeStep>>(
    `/api/v1/master/grade-step/${grade}/${step}`,
    body,
  );
  return data;
}

export async function fetchAllowanceRates(): Promise<ApiEnvelope<AllowanceRate[]>> {
  const { data } = await apiClient.get<ApiEnvelope<AllowanceRate[]>>("/api/v1/master/allowance-rates");
  return data;
}

export async function createAllowanceRate(body: AllowanceRateCreate): Promise<ApiEnvelope<AllowanceRate>> {
  const { data } = await apiClient.post<ApiEnvelope<AllowanceRate>>("/api/v1/master/allowance-rates", body);
  return data;
}

export async function updateAllowanceRate(
  name: string,
  body: Partial<AllowanceRate>,
): Promise<ApiEnvelope<AllowanceRate>> {
  const { data } = await apiClient.put<ApiEnvelope<AllowanceRate>>(
    `/api/v1/master/allowance-rates/${encodeURIComponent(name)}`,
    body,
  );
  return data;
}

export async function fetchGradeDerivations(): Promise<ApiEnvelope<GradeDerivation[]>> {
  const { data } = await apiClient.get<ApiEnvelope<GradeDerivation[]>>("/api/v1/master/grade-derivation");
  return data;
}

export async function deriveGrade(params: {
  education_level: string;
  prior_experience_years: number;
  years_of_service: number;
}): Promise<ApiEnvelope<DeriveResult>> {
  const { data } = await apiClient.get<ApiEnvelope<DeriveResult>>("/api/v1/master/grade-derivation/derive", {
    params,
  });
  return data;
}

export async function createGradeDerivation(
  body: GradeDerivationCreate,
): Promise<ApiEnvelope<GradeDerivation>> {
  const { data } = await apiClient.post<ApiEnvelope<GradeDerivation>>("/api/v1/master/grade-derivation", body);
  return data;
}

export async function updateGradeDerivation(
  edu: string,
  exp: number,
  body: { derived_grade: number; derived_step: number },
): Promise<ApiEnvelope<GradeDerivation>> {
  const { data } = await apiClient.put<ApiEnvelope<GradeDerivation>>(
    `/api/v1/master/grade-derivation/${encodeURIComponent(edu)}/${exp}`,
    body,
  );
  return data;
}

export async function fetchOrgs(): Promise<ApiEnvelope<OrgRow[]>> {
  const { data } = await apiClient.get<ApiEnvelope<OrgRow[]>>("/api/v1/master/org");
  return data;
}

export async function createOrg(body: OrgCreate): Promise<ApiEnvelope<OrgRow>> {
  const { data } = await apiClient.post<ApiEnvelope<OrgRow>>("/api/v1/master/org", body);
  return data;
}

export async function updateOrg(
  ministry_name: string,
  dept_key: string,
  body: Partial<OrgRow>,
): Promise<ApiEnvelope<OrgRow>> {
  const { data } = await apiClient.put<ApiEnvelope<OrgRow>>(
    `/api/v1/master/org/${encodeURIComponent(ministry_name)}/${encodeURIComponent(dept_key)}`,
    body,
  );
  return data;
}

export async function fetchLocations(): Promise<ApiEnvelope<Location[]>> {
  const { data } = await apiClient.get<ApiEnvelope<Location[]>>("/api/v1/master/location");
  return data;
}

export async function createLocation(body: Location): Promise<ApiEnvelope<Location>> {
  const { data } = await apiClient.post<ApiEnvelope<Location>>("/api/v1/master/location", {
    province: body.province,
    region: body.region,
    is_remote_area: body.is_remote_area,
    is_hazardous_area: body.is_hazardous_area,
  });
  return data;
}

export async function updateLocation(
  province: string,
  body: Partial<Location>,
): Promise<ApiEnvelope<Location>> {
  const { data } = await apiClient.put<ApiEnvelope<Location>>(
    `/api/v1/master/location/${encodeURIComponent(province)}`,
    body,
  );
  return data;
}

export async function fetchBanks(): Promise<ApiEnvelope<Bank[]>> {
  const { data } = await apiClient.get<ApiEnvelope<Bank[]>>("/api/v1/master/bank");
  return data;
}

export async function createBank(body: Bank): Promise<ApiEnvelope<Bank>> {
  const { data } = await apiClient.post<ApiEnvelope<Bank>>("/api/v1/master/bank", {
    bank_name: body.bank_name,
    bank_code: body.bank_code,
    swift_code: body.swift_code ?? undefined,
    is_active: body.is_active,
  });
  return data;
}

export async function updateBank(
  bankName: string,
  bankCode: string,
  body: BankUpdate,
): Promise<ApiEnvelope<Bank>> {
  const { data } = await apiClient.put<ApiEnvelope<Bank>>(
    `/api/v1/master/bank/${encodeURIComponent(bankName)}/${encodeURIComponent(bankCode)}`,
    body,
  );
  return data;
}

export async function fetchPITBrackets(): Promise<ApiEnvelope<PITBracket[]>> {
  const { data } = await apiClient.get<ApiEnvelope<PITBracket[]>>("/api/v1/master/pit-brackets");
  return data;
}

export async function updatePITBracket(
  bracket_no: number,
  body: Partial<PITBracket>,
): Promise<ApiEnvelope<PITBracket>> {
  const { data } = await apiClient.put<ApiEnvelope<PITBracket>>(
    `/api/v1/master/pit-brackets/${bracket_no}`,
    body,
  );
  return data;
}
