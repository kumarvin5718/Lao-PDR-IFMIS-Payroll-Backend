/** API layer: `master` — typed calls to backend `/api/v1`. */
import { apiClient } from "@/api/client";
import type { ApiEnvelope } from "@/types/auth";

export interface GradeStep {
  grade: number;
  step: number;
  grade_step_key: string;
  grade_step_index: number;
  salary_index_rate: number;
  min_education: string | null;
  min_prior_experience_years: number | null;
  basic_salary: number;
  notes: string | null;
  effective_from: string | null;
  effective_to: string | null;
  last_updated: string | null;
  last_updated_by: string | null;
  circular_ref: string | null;
  change_remarks: string | null;
}

export interface GradeStepsListPayload {
  items: GradeStep[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface AllowanceRate {
  allowance_name: string;
  rate_type: string;
  rate_value: number;
  /** Same as effective_from when present; kept for compatibility. */
  effective_date: string | null;
  eligibility: string | null;
  description: string | null;
  effective_from: string | null;
  effective_to: string | null;
  circular_ref: string | null;
  change_remarks: string | null;
}

export interface AllowanceRatesListPayload {
  items: AllowanceRate[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface AllowanceRateCreate {
  allowance_name: string;
  rate_type: string;
  rate_value: number;
  effective_date: string | null;
  eligibility?: string | null;
  description?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  circular_ref?: string | null;
  change_remarks?: string | null;
}

export interface GradeDerivation {
  education_level: string;
  min_exp_years: number;
  exp_max_years: number | null;
  derived_grade: number;
  derived_step: number;
  rule_description: string | null;
  effective_from?: string | null;
  circular_ref?: string | null;
}

export interface GradeDerivationsListPayload {
  items: GradeDerivation[];
  total: number;
  page: number;
  size: number;
  pages: number;
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
  ministry_key: string;
  department_name: string;
  department_key: string;
  division_name: string | null;
  profession_category: string;
  na_allowance_eligible: boolean;
  field_allowance_type: string | null;
  effective_from: string | null;
  effective_to: string | null;
  circular_ref: string | null;
  is_active: boolean;
}

export interface OrgCreate {
  ministry_name: string;
  ministry_key: string;
  department_name: string;
  department_key: string;
  division_name?: string | null;
  profession_category?: string;
  na_allowance_eligible?: boolean;
  field_allowance_type?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  circular_ref?: string | null;
  change_remarks?: string | null;
}

export interface OrgUpdate {
  department_name?: string | null;
  division_name?: string | null;
  profession_category?: string | null;
  na_allowance_eligible?: boolean | null;
  field_allowance_type?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  circular_ref?: string | null;
  change_remarks?: string | null;
  is_active?: boolean | null;
}

export interface Location {
  district_key: string;
  country: string;
  country_key: string;
  province_key: string;
  province: string;
  district: string;
  is_remote_area: boolean;
  is_hazardous_area: boolean;
  is_active: boolean;
}

export interface LocationCreate {
  district_key: string;
  country: string;
  country_key: string;
  province_key: string;
  province: string;
  district: string;
  is_remote_area?: boolean;
  is_hazardous_area?: boolean;
}

export interface LocationUpdate {
  district?: string;
  is_remote_area?: boolean;
  is_hazardous_area?: boolean;
  is_active?: boolean;
}

export interface Bank {
  bank_name: string;
  bank_key: string;
  branch_name: string;
  bank_code: string;
  swift_code: string | null;
  is_active: boolean;
  category: string | null;
  bank_abbrev: string | null;
  city: string | null;
  branch_address: string | null;
  bank_hq_address: string | null;
  telephone: string | null;
  ownership: string | null;
  established: string | null;
  website: string | null;
  effective_from: string | null;
  effective_to: string | null;
  last_updated: string | null;
  last_updated_by: string | null;
  circular_ref: string | null;
  change_remarks: string | null;
}

export interface BanksListPayload {
  items: Bank[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface BankUpdate {
  swift_code?: string | null;
  is_active?: boolean;
  category?: string | null;
  bank_abbrev?: string | null;
  city?: string | null;
  branch_address?: string | null;
  bank_hq_address?: string | null;
  telephone?: string | null;
  ownership?: string | null;
  established?: string | null;
  website?: string | null;
  circular_ref?: string | null;
  change_remarks?: string | null;
}

export interface PITBracket {
  bracket_no: number;
  lower_bound: number;
  upper_bound: number | null;
  rate_pct: number;
  deduction_amount: number;
  description?: string | null;
  effective_from?: string | null;
  circular_ref?: string | null;
}

export interface PITBracketsListPayload {
  items: PITBracket[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface DeriveResult {
  grade: number;
  step: number;
  derived: boolean;
}

export async function fetchGradeSteps(params?: {
  page?: number;
  size?: number;
  search?: string;
}): Promise<ApiEnvelope<GradeStepsListPayload>> {
  const { data } = await apiClient.get<ApiEnvelope<GradeStepsListPayload>>("/api/v1/master/grade-step", {
    params: {
      page: params?.page ?? 1,
      size: params?.size ?? 20,
      search: params?.search,
    },
  });
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

export async function fetchAllowanceRates(params?: {
  page?: number;
  size?: number;
  search?: string;
}): Promise<ApiEnvelope<AllowanceRatesListPayload>> {
  const { data } = await apiClient.get<ApiEnvelope<AllowanceRatesListPayload>>("/api/v1/master/allowance-rates", {
    params: {
      page: params?.page ?? 1,
      size: params?.size ?? 20,
      search: params?.search?.trim() || undefined,
    },
  });
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

export async function fetchGradeDerivations(params?: {
  page?: number;
  size?: number;
  search?: string;
}): Promise<ApiEnvelope<GradeDerivationsListPayload>> {
  const { data } = await apiClient.get<ApiEnvelope<GradeDerivationsListPayload>>("/api/v1/master/grade-derivation", {
    params: {
      page: params?.page ?? 1,
      size: params?.size ?? 20,
      search: params?.search,
    },
  });
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
  body: { derived_grade: number; derived_step: number; rule_description?: string | null },
): Promise<ApiEnvelope<GradeDerivation>> {
  const { data } = await apiClient.put<ApiEnvelope<GradeDerivation>>(
    `/api/v1/master/grade-derivation/${encodeURIComponent(edu)}/${exp}`,
    body,
  );
  return data;
}

export interface MinistryMasterRow {
  ministry_key: string;
  ministry_name: string;
  profession_category: string | null;
  na_allowance_eligible: boolean;
  field_allowance_type: string | null;
  effective_from: string | null;
  circular_ref: string | null;
}

export interface MinistriesMasterListPayload {
  items: MinistryMasterRow[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export type MinistryMasterUpdate = {
  ministry_name?: string;
  profession_category?: string | null;
  na_allowance_eligible?: boolean;
  field_allowance_type?: string | null;
  effective_from?: string | null;
  circular_ref?: string | null;
};

export async function fetchMinistriesMaster(params?: {
  page?: number;
  size?: number;
  search?: string;
}): Promise<ApiEnvelope<MinistriesMasterListPayload>> {
  const { data } = await apiClient.get<ApiEnvelope<MinistriesMasterListPayload>>("/api/v1/master/ministry", {
    params: {
      page: params?.page ?? 1,
      size: params?.size ?? 20,
      search: params?.search?.trim() || undefined,
    },
  });
  return data;
}

export async function updateMinistryMaster(
  ministry_key: string,
  body: MinistryMasterUpdate,
): Promise<ApiEnvelope<MinistryMasterRow>> {
  const { data } = await apiClient.put<ApiEnvelope<MinistryMasterRow>>(
    `/api/v1/master/ministry/${encodeURIComponent(ministry_key)}`,
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
  ministry_key: string,
  department_key: string,
  body: OrgUpdate,
): Promise<ApiEnvelope<OrgRow>> {
  const { data } = await apiClient.put<ApiEnvelope<OrgRow>>(
    `/api/v1/master/org/${encodeURIComponent(ministry_key)}/${encodeURIComponent(department_key)}`,
    body,
  );
  return data;
}

export async function fetchLocations(): Promise<ApiEnvelope<Location[]>> {
  const { data } = await apiClient.get<ApiEnvelope<Location[]>>("/api/v1/master/location");
  return data;
}

export async function createLocation(body: LocationCreate): Promise<ApiEnvelope<Location>> {
  const { data } = await apiClient.post<ApiEnvelope<Location>>("/api/v1/master/location", body);
  return data;
}

export async function updateLocation(
  districtKey: string,
  body: LocationUpdate,
): Promise<ApiEnvelope<Location>> {
  const { data } = await apiClient.put<ApiEnvelope<Location>>(
    `/api/v1/master/location/${encodeURIComponent(districtKey)}`,
    body,
  );
  return data;
}

export async function fetchBanks(params?: {
  page?: number;
  size?: number;
  search?: string;
  active_only?: boolean;
}): Promise<ApiEnvelope<BanksListPayload>> {
  const { data } = await apiClient.get<ApiEnvelope<BanksListPayload>>("/api/v1/master/bank", {
    params: {
      page: params?.page ?? 1,
      size: params?.size ?? 20,
      search: params?.search?.trim() || undefined,
      active_only: params?.active_only ?? true,
    },
  });
  return data;
}

export async function createBank(body: {
  bank_name: string;
  bank_code: string;
  swift_code?: string | null;
  is_active: boolean;
  branch_name?: string | null;
  category?: string | null;
  bank_abbrev?: string | null;
  city?: string | null;
  branch_address?: string | null;
  bank_hq_address?: string | null;
  telephone?: string | null;
  ownership?: string | null;
  established?: string | null;
  website?: string | null;
}): Promise<ApiEnvelope<Bank>> {
  const { data } = await apiClient.post<ApiEnvelope<Bank>>("/api/v1/master/bank", {
    bank_name: body.bank_name,
    bank_code: body.bank_code,
    swift_code: body.swift_code ?? undefined,
    is_active: body.is_active,
    branch_name: body.branch_name ?? undefined,
    category: body.category ?? undefined,
    bank_abbrev: body.bank_abbrev ?? undefined,
    city: body.city ?? undefined,
    branch_address: body.branch_address ?? undefined,
    bank_hq_address: body.bank_hq_address ?? undefined,
    telephone: body.telephone ?? undefined,
    ownership: body.ownership ?? undefined,
    established: body.established ?? undefined,
    website: body.website ?? undefined,
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

export async function fetchPITBrackets(params?: {
  page?: number;
  size?: number;
  search?: string;
}): Promise<ApiEnvelope<PITBracketsListPayload>> {
  const { data } = await apiClient.get<ApiEnvelope<PITBracketsListPayload>>("/api/v1/master/pit-brackets", {
    params: {
      page: params?.page ?? 1,
      size: params?.size ?? 20,
      search: params?.search?.trim() || undefined,
    },
  });
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
