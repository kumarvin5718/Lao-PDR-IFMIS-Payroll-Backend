/** Screen: `EmployeeFormPage` — page-level UI and mutations. */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Breadcrumb,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  message,
  Row,
  Select,
  Space,
  Spin,
  Tabs,
  Typography,
} from "antd";
import { isAxiosError } from "axios";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { apiClient } from "@/api/client";
import { deriveGrade } from "@/api/master";
import {
  createEmployee,
  fetchEmployee,
  updateEmployee,
  type EmployeeCreate,
  type EmployeeOut,
} from "@/api/employees";
import { useBranches, useDepartments, useProvinces } from "@/api/lookups";
import { useMinistries } from "@/hooks/useLookups";
import type { ApiEnvelope } from "@/types/auth";
import { useAuthStore } from "@/store/authStore";

const INPUT_BASE: React.CSSProperties = {
  border: "0.5px solid #DDE1EA",
  borderRadius: 8,
  fontSize: 14,
  padding: "9px 12px",
  background: "#FAFBFC",
};

const LABEL_REQ = (label: string) => (
  <span>
    {label}
    <span style={{ color: "#E24B4A", fontSize: 12, marginLeft: 2 }}>*</span>
  </span>
);

const EDUCATION_OPTIONS = [
  "Bachelor's Degree",
  "Master's Degree",
  "PhD",
  "Diploma",
  "Certificate",
  "Other",
];

const PROFESSION_OPTIONS = [
  "General",
  "Teaching",
  "Medical",
  "Engineering",
  "Administrative",
  "Security",
  "Other",
];

const COUNTRY_OPTIONS = ["Lao PDR", "Thailand", "Vietnam", "China", "Other"];

function parseMasterLocation(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data)) {
    const names = (data as { province?: string }[])
      .map((x) => x.province)
      .filter((x): x is string => Boolean(x));
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }
  return [];
}

function parseMasterBank(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const rows = Array.isArray(data)
    ? data
    : "items" in data && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : [];
  const names = (rows as { bank_name?: string }[])
    .map((x) => x.bank_name)
    .filter((x): x is string => Boolean(x));
  return [...new Set(names)];
}

function parseAllowanceRates(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const rows = Array.isArray(data)
    ? data
    : "items" in data && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : [];
  return (rows as { allowance_name?: string }[])
    .map((x) => x.allowance_name)
    .filter((x): x is string => Boolean(x));
}

const formShape = {
  employee_code: z.string().optional(),
  title: z.enum(["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."]),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  gender: z.enum(["Male", "Female", "Other"]),
  date_of_birth: z.string().min(1),
  email: z.string().regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid email format"),
  mobile_number: z.string().optional(),
  date_of_joining: z.string().min(1),
  employment_type: z.enum(["Permanent", "Probationary", "Contract", "Intern"]),
  position_title: z.string().min(1),
  education_level: z.string().min(1),
  prior_experience_years: z.number().min(0).max(40),
  grade: z.number().min(1).max(10),
  step: z.number().min(1).max(15),
  civil_service_card_id: z.string().min(1),
  sso_number: z.string().optional(),
  ministry_name: z.string().min(1),
  department_name: z.string().min(1),
  division_name: z.string().optional(),
  service_country: z.string().min(1),
  service_province: z.string().min(1),
  service_district: z.string().optional(),
  profession_category: z.string().min(1),
  is_remote_area: z.boolean(),
  is_foreign_posting: z.boolean(),
  is_hazardous_area: z.boolean(),
  house_no: z.string().optional(),
  street: z.string().optional(),
  area_baan: z.string().optional(),
  province_of_residence: z.string().optional(),
  pin_code: z.string().optional(),
  residence_country: z.string().optional(),
  bank_name: z.string().min(1),
  bank_branch: z.string().min(1),
  bank_branch_code: z.string().optional(),
  bank_account_no: z.string().min(1),
  swift_code: z.string().optional(),
  has_spouse: z.boolean(),
  eligible_children: z.number().min(0).max(3),
  position_level: z.string().min(1),
  is_na_member: z.boolean(),
  field_allowance_type: z.string().min(1),
  is_active: z.boolean(),
};

const employeeFormSchema = z.object(formShape);

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

function defaultValues(scope: string | null | undefined): EmployeeFormValues {
  return {
    employee_code: "",
    title: "Mr.",
    first_name: "",
    last_name: "",
    gender: "Male",
    date_of_birth: "",
    email: "",
    mobile_number: "",
    date_of_joining: dayjs().format("YYYY-MM-DD"),
    employment_type: "Permanent",
    position_title: "",
    education_level: "Bachelor's Degree",
    prior_experience_years: 0,
    grade: 1,
    step: 1,
    civil_service_card_id: "",
    sso_number: "",
    ministry_name: scope ?? "",
    department_name: "",
    division_name: "",
    service_country: "Lao PDR",
    service_province: "",
    service_district: "",
    profession_category: "General",
    is_remote_area: false,
    is_foreign_posting: false,
    is_hazardous_area: false,
    house_no: "",
    street: "",
    area_baan: "",
    province_of_residence: "",
    pin_code: "",
    residence_country: "",
    bank_name: "",
    bank_branch: "",
    bank_branch_code: "",
    bank_account_no: "",
    swift_code: "",
    has_spouse: false,
    eligible_children: 0,
    position_level: "",
    is_na_member: false,
    field_allowance_type: "None",
    is_active: true,
  };
}

function outToForm(e: EmployeeOut, scope: string | null | undefined): EmployeeFormValues {
  return {
    employee_code: e.employee_code,
    title: e.title as EmployeeFormValues["title"],
    first_name: e.first_name,
    last_name: e.last_name,
    gender: e.gender as EmployeeFormValues["gender"],
    date_of_birth: e.date_of_birth.slice(0, 10),
    email: e.email,
    mobile_number: e.mobile_number ?? "",
    date_of_joining: e.date_of_joining.slice(0, 10),
    employment_type: e.employment_type as EmployeeFormValues["employment_type"],
    position_title: e.position_title,
    education_level: e.education_level,
    prior_experience_years: e.prior_experience_years,
    grade: e.grade,
    step: e.step,
    civil_service_card_id: e.civil_service_card_id,
    sso_number: e.sso_number ?? "",
    ministry_name: e.ministry_name || scope || "",
    department_name: e.department_name,
    division_name: e.division_name ?? "",
    service_country: e.service_country,
    service_province: e.service_province,
    service_district: e.service_district ?? "",
    profession_category: e.profession_category,
    is_remote_area: e.is_remote_area,
    is_foreign_posting: e.is_foreign_posting,
    is_hazardous_area: e.is_hazardous_area,
    house_no: e.house_no ?? "",
    street: e.street ?? "",
    area_baan: e.area_baan ?? "",
    province_of_residence: e.province_of_residence ?? "",
    pin_code: e.pin_code ?? "",
    residence_country: e.residence_country ?? "",
    bank_name: e.bank_name,
    bank_branch: e.bank_branch,
    bank_branch_code: e.bank_branch_code ?? "",
    bank_account_no: e.bank_account_no,
    swift_code: e.swift_code ?? "",
    has_spouse: e.has_spouse,
    eligible_children: e.eligible_children,
    position_level: e.position_level,
    is_na_member: e.is_na_member,
    field_allowance_type: e.field_allowance_type as EmployeeFormValues["field_allowance_type"],
    is_active: e.is_active,
  };
}

function formToPayload(v: EmployeeFormValues): EmployeeCreate {
  return {
    employee_code: v.employee_code as string,
    title: v.title,
    first_name: v.first_name,
    last_name: v.last_name,
    gender: v.gender,
    date_of_birth: v.date_of_birth,
    email: v.email,
    mobile_number: v.mobile_number || null,
    date_of_joining: v.date_of_joining,
    employment_type: v.employment_type,
    position_title: v.position_title,
    education_level: v.education_level,
    prior_experience_years: v.prior_experience_years,
    grade: v.grade,
    step: v.step,
    civil_service_card_id: v.civil_service_card_id,
    sso_number: v.sso_number || null,
    ministry_name: v.ministry_name,
    department_name: v.department_name,
    division_name: v.division_name || null,
    service_country: v.service_country,
    service_province: v.service_province,
    service_district: v.service_district || null,
    profession_category: v.profession_category,
    is_remote_area: v.is_remote_area,
    is_foreign_posting: v.is_foreign_posting,
    is_hazardous_area: v.is_hazardous_area,
    house_no: v.house_no || null,
    street: v.street || null,
    area_baan: v.area_baan || null,
    province_of_residence: v.province_of_residence || null,
    pin_code: v.pin_code || null,
    residence_country: v.residence_country || null,
    bank_name: v.bank_name,
    bank_branch: v.bank_branch,
    bank_branch_code: v.bank_branch_code || null,
    bank_account_no: v.bank_account_no,
    swift_code: v.swift_code || null,
    has_spouse: v.has_spouse,
    eligible_children: v.eligible_children,
    position_level: v.position_level,
    is_na_member: v.is_na_member,
    field_allowance_type: v.field_allowance_type as EmployeeCreate["field_allowance_type"],
    is_active: v.is_active,
  };
}

function getApiErrorCode(err: unknown): string | undefined {
  if (
    err &&
    typeof err === "object" &&
    "apiCode" in err &&
    typeof (err as { apiCode: unknown }).apiCode === "string"
  ) {
    return (err as { apiCode: string }).apiCode;
  }
  if (
    isAxiosError(err) &&
    err.response?.data &&
    typeof err.response.data === "object" &&
    err.response.data !== null &&
    "error" in err.response.data
  ) {
    return (err.response.data as ApiEnvelope<null>).error?.code;
  }
  return undefined;
}

function retirementDate(dobIso: string): string {
  if (!dobIso) return "—";
  return dayjs(dobIso).add(60, "year").format("DD/MM/YYYY");
}

function yearsOfService(joinIso: string): number {
  if (!joinIso) return 0;
  const j = dayjs(joinIso).startOf("day");
  return Math.floor(dayjs().diff(j, "day") / 365);
}

export function EmployeeFormPage() {
  const { code } = useParams<{ code: string }>();
  const isEdit = Boolean(code);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const scope = "";

  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: defaultValues(scope),
  });

  const dob = useWatch({ control, name: "date_of_birth" });
  const doj = useWatch({ control, name: "date_of_joining" });
  const educationLevel = useWatch({ control, name: "education_level" });
  const priorExp = useWatch({ control, name: "prior_experience_years" });
  const gradeVal = useWatch({ control, name: "grade" });
  const stepVal = useWatch({ control, name: "step" });
  const bankNameWatch = useWatch({ control, name: "bank_name" });

  const { data: departments = [] } = useDepartments();
  const { data: residenceProvinces = [] } = useProvinces();
  const { data: branchNames = [], isFetching: branchesLoading } = useBranches(
    bankNameWatch?.trim() ? bankNameWatch : null,
  );

  const yos = useMemo(() => yearsOfService(doj ?? ""), [doj]);
  const retireStr = useMemo(() => retirementDate(dob ?? ""), [dob]);

  const { data: empRes, isLoading: loadingEmp } = useQuery({
    queryKey: ["employee", code],
    queryFn: async () => fetchEmployee(code!),
    enabled: isEdit && Boolean(code),
  });

  useEffect(() => {
    if (!isEdit || !empRes?.success || !empRes.data) return;
    reset(outToForm(empRes.data, scope));
  }, [empRes, isEdit, reset, scope]);

  const { data: ministries = [] } = useMinistries();

  const { data: provinces = [] } = useQuery({
    queryKey: ["master", "location"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<unknown>>("/api/v1/master/location");
      if (!data.success || data.data == null) return [];
      return parseMasterLocation(data.data);
    },
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["master", "bank"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<unknown>>("/api/v1/master/bank", {
        params: { page: 1, size: 500, active_only: true },
      });
      if (!data.success || data.data == null) return [];
      return parseMasterBank(data.data);
    },
  });

  const { data: allowanceNames = [] } = useQuery({
    queryKey: ["master", "allowance-rates", "all-names"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<unknown>>("/api/v1/master/allowance-rates", {
        params: { page: 1, size: 200 },
      });
      if (!data.success || data.data == null) return [];
      return parseAllowanceRates(data.data);
    },
  });

  const { data: derivedGrade, isFetching: deriving } = useQuery({
    queryKey: ["grade-derivation", "derive", educationLevel, priorExp, yos],
    queryFn: async () => {
      const res = await deriveGrade({
        education_level: educationLevel,
        prior_experience_years: priorExp,
        years_of_service: yos,
      });
      if (!res.success || !res.data) return null;
      return res.data;
    },
    enabled: Boolean(educationLevel && doj),
  });

  useEffect(() => {
    if (derivedGrade?.grade != null && derivedGrade.step != null) {
      setValue("grade", derivedGrade.grade);
      setValue("step", derivedGrade.step);
    }
  }, [derivedGrade, setValue]);

  const ministryLocked = false;

  const createMut = useMutation({
    mutationFn: async (body: EmployeeCreate) => {
      const res = await createEmployee(body);
      if (!res.success) {
        const err = new Error(res.error?.message ?? "fail");
        Object.assign(err, { apiCode: res.error?.code });
        throw err;
      }
      return res;
    },
    onSuccess: async () => {
      message.success(t("employee.saved_success"));
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      navigate("/employees");
    },
  });

  const updateMut = useMutation({
    mutationFn: async (payload: Partial<EmployeeCreate>) => {
      const res = await updateEmployee(code!, payload);
      if (!res.success) {
        const err = new Error(res.error?.message ?? "fail");
        Object.assign(err, { apiCode: res.error?.code });
        throw err;
      }
      return res;
    },
    onSuccess: async () => {
      message.success(t("employee.saved_success"));
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      await queryClient.invalidateQueries({ queryKey: ["employee", code] });
      navigate("/employees");
    },
  });

  const errCount = Object.keys(errors).length;

  const onSubmit = async (vals: EmployeeFormValues) => {
    setSubmitError(null);
    const errMap: Record<string, string> = {
      ERR_EMP_CODE_DUPLICATE: t("employee.errors.ERR_EMP_CODE_DUPLICATE"),
      ERR_EMP_EMAIL_DUPLICATE: t("employee.errors.ERR_EMP_EMAIL_DUPLICATE"),
      ERR_EMP_CSC_DUPLICATE: t("employee.errors.ERR_EMP_CSC_DUPLICATE"),
      ERR_EMP_BANK_ACCT_DUPLICATE: t("employee.errors.ERR_EMP_BANK_ACCT_DUPLICATE"),
      ERR_EMP_INVALID_DOB: t("employee.errors.ERR_EMP_INVALID_DOB"),
      ERR_EMP_INVALID_JOINING: t("employee.errors.ERR_EMP_INVALID_JOINING"),
      ERR_EMP_NOT_FOUND: t("employee.errors.ERR_EMP_NOT_FOUND"),
    };
    try {
      if (!isEdit) {
        if (!vals.employee_code || !/^LAO\d{5}$/.test(vals.employee_code)) {
          setSubmitError(t("employee.errors.ERR_EMP_CODE_DUPLICATE"));
          return;
        }
        await createMut.mutateAsync(formToPayload({ ...vals, employee_code: vals.employee_code }));
      } else {
        const payload = formToPayload({ ...vals, employee_code: code! });
        const partial: Partial<EmployeeCreate> = { ...payload };
        delete (partial as { employee_code?: string }).employee_code;
        await updateMut.mutateAsync(partial);
      }
    } catch (e) {
      const c = getApiErrorCode(e);
      setSubmitError(c && errMap[c] ? errMap[c] : t("employee.errors.generic"));
    }
  };

  const pending = createMut.isPending || updateMut.isPending || isSubmitting;

  if (isEdit && loadingEmp) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            border: "3px solid #1B3A6B",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "ifms-spin 0.7s linear infinite",
          }}
        />
        <style>{`@keyframes ifms-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const inputProps = (name: keyof EmployeeFormValues) => ({
    style: INPUT_BASE,
    status: errors[name] ? ("error" as const) : undefined,
  });

  return (
    <div style={{ paddingBottom: 96 }}>
      <Breadcrumb
        items={[
          { title: <Link to="/employees">{t("page.employees.list.title")}</Link> },
          { title: isEdit ? t("employee.edit_title") : t("employee.add_title") },
        ]}
        style={{ marginBottom: 12 }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0, color: "#1B3A6B" }}>
          {isEdit ? t("employee.edit_title") : t("employee.add_title")}
        </Typography.Title>
        <Button onClick={() => navigate(-1)}>{t("common.cancel")}</Button>
      </div>

      {submitError && (
        <div
          style={{
            background: "#FFF0F0",
            borderLeft: "3px solid #E24B4A",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 13,
            color: "#A32D2D",
            marginBottom: 16,
          }}
        >
          {submitError}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit, (errors) => {
          console.error("Form validation errors:", JSON.stringify(errors, null, 2));
        })}
      >
        <Tabs
          items={[
            {
              key: "1",
              label: t("employee.tabs.personal"),
              children: (
                <Row gutter={[16, 16]}>
                  {!isEdit && (
                    <Col xs={24} md={12}>
                      <Form.Item label={LABEL_REQ(t("employee.f_employee_code"))}>
                        <Controller
                          name="employee_code"
                          control={control}
                          render={({ field }) => (
                            <Input {...field} {...inputProps("employee_code")} placeholder={t("employee.placeholder_employee_code")} />
                          )}
                        />
                      </Form.Item>
                    </Col>
                  )}
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_title"))}>
                      <Controller
                        name="title"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            options={[
                              { label: t("employee.opt_title_mr"), value: "Mr." },
                              { label: t("employee.opt_title_ms"), value: "Ms." },
                              { label: t("employee.opt_title_mrs"), value: "Mrs." },
                              { label: t("employee.opt_title_dr"), value: "Dr." },
                              { label: t("employee.opt_title_prof"), value: "Prof." },
                            ]}
                            style={{ width: "100%" }}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_first_name"))}>
                      <Controller
                        name="first_name"
                        control={control}
                        render={({ field }) => <Input {...field} {...inputProps("first_name")} />}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_last_name"))}>
                      <Controller
                        name="last_name"
                        control={control}
                        render={({ field }) => <Input {...field} {...inputProps("last_name")} />}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_gender"))}>
                      <Controller
                        name="gender"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            options={[
                              { label: t("employee.opt_gender_male"), value: "Male" },
                              { label: t("employee.opt_gender_female"), value: "Female" },
                              { label: t("employee.opt_gender_other"), value: "Other" },
                            ]}
                            style={{ width: "100%" }}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_dob"))}>
                      <Controller
                        name="date_of_birth"
                        control={control}
                        render={({ field }) => (
                          <DatePicker
                            format="DD/MM/YYYY"
                            style={{ width: "100%", ...INPUT_BASE }}
                            value={field.value ? dayjs(field.value) : null}
                            onChange={(d: Dayjs | null) =>
                              field.onChange(d ? d.format("YYYY-MM-DD") : "")
                            }
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_email"))}>
                      <Controller
                        name="email"
                        control={control}
                        render={({ field }) => (
                          <Input {...field} type="email" {...inputProps("email")} />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={t("employee.f_mobile")}>
                      <Controller
                        name="mobile_number"
                        control={control}
                        render={({ field }) => <Input {...field} {...inputProps("mobile_number")} />}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_csc"))}>
                      <Controller
                        name="civil_service_card_id"
                        control={control}
                        render={({ field }) => (
                          <Input {...field} maxLength={12} {...inputProps("civil_service_card_id")} />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={t("employee.f_sso")}>
                      <Controller
                        name="sso_number"
                        control={control}
                        render={({ field }) => (
                          <Input {...field} maxLength={12} {...inputProps("sso_number")} />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_employment_type"))}>
                      <Controller
                        name="employment_type"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            options={[
                              { label: t("employee.opt_emp_permanent"), value: "Permanent" },
                              { label: t("employee.opt_emp_probationary"), value: "Probationary" },
                              { label: t("employee.opt_emp_contract"), value: "Contract" },
                              { label: t("employee.opt_emp_intern"), value: "Intern" },
                            ]}
                            style={{ width: "100%" }}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_doj"))}>
                      <Controller
                        name="date_of_joining"
                        control={control}
                        render={({ field }) => (
                          <DatePicker
                            format="DD/MM/YYYY"
                            style={{ width: "100%", ...INPUT_BASE }}
                            value={field.value ? dayjs(field.value) : null}
                            onChange={(d: Dayjs | null) =>
                              field.onChange(d ? d.format("YYYY-MM-DD") : "")
                            }
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_position_title"))}>
                      <Controller
                        name="position_title"
                        control={control}
                        render={({ field }) => <Input {...field} {...inputProps("position_title")} />}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <div
                      style={{
                        background: "#F7F8FA",
                        border: "0.5px solid #DDE1EA",
                        borderRadius: 8,
                        padding: "12px 16px",
                        fontSize: 14,
                        color: "#3D4A60",
                      }}
                    >
                      <div>
                        {t("employee.years_of_service")}: {yos}{" "}
                        {t("employee.years_suffix")}
                      </div>
                      <div>
                        {t("employee.retirement_date")}: {retireStr}
                      </div>
                    </div>
                  </Col>
                </Row>
              ),
            },
            {
              key: "2",
              label: t("employee.tabs.grade"),
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_education"))}>
                      <Controller
                        name="education_level"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            options={EDUCATION_OPTIONS.map((x) => ({ label: x, value: x }))}
                            style={{ width: "100%" }}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={t("employee.f_prior_exp")}>
                      <Controller
                        name="prior_experience_years"
                        control={control}
                        render={({ field }) => (
                          <InputNumber
                            min={0}
                            max={40}
                            style={{ width: "100%" }}
                            value={field.value}
                            onChange={(v) => field.onChange(v ?? 0)}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_position_level"))}>
                      <Controller
                        name="position_level"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            options={allowanceNames.map((x) => ({ label: x, value: x }))}
                            showSearch
                            style={{ width: "100%" }}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_profession"))}>
                      <Controller
                        name="profession_category"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            options={PROFESSION_OPTIONS.map((x) => ({ label: x, value: x }))}
                            style={{ width: "100%" }}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                      {t("employee.grade_blurb")}
                    </Typography.Paragraph>
                    <div
                      style={{
                        background: "#F7F8FA",
                        border: "0.5px solid #DDE1EA",
                        borderRadius: 8,
                        padding: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {deriving && <Spin size="small" />}
                      <Typography.Text>
                        {t("employee.grade_derived", {
                          grade: gradeVal ?? 0,
                          step: stepVal ?? 0,
                        })}
                      </Typography.Text>
                    </div>
                  </Col>
                </Row>
              ),
            },
            {
              key: "3",
              label: t("employee.tabs.assignment"),
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_ministry"))}>
                      <Controller
                        name="ministry_name"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            disabled={ministryLocked}
                            options={ministries.map((m) => ({ label: m, value: m }))}
                            showSearch
                            style={{ width: "100%" }}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_department"))}>
                      <Controller
                        name="department_name"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            options={departments.map((d) => ({ label: d, value: d }))}
                            showSearch
                            optionFilterProp="label"
                            style={{ width: "100%" }}
                            status={errors.department_name ? "error" : undefined}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={t("employee.f_division")}>
                      <Controller
                        name="division_name"
                        control={control}
                        render={({ field }) => <Input {...field} {...inputProps("division_name")} />}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_service_country"))}>
                      <Controller
                        name="service_country"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            options={COUNTRY_OPTIONS.map((c) => ({ label: c, value: c }))}
                            showSearch
                            style={{ width: "100%" }}
                            status={errors.service_country ? "error" : undefined}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={LABEL_REQ(t("employee.f_service_province"))}>
                      <Controller
                        name="service_province"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            options={provinces.map((p) => ({ label: p, value: p }))}
                            showSearch
                            style={{ width: "100%" }}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={t("employee.f_service_district")}>
                      <Controller
                        name="service_district"
                        control={control}
                        render={({ field }) => <Input {...field} {...inputProps("service_district")} />}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label={t("employee.f_remote")}>
                      <Controller
                        name="is_remote_area"
                        control={control}
                        render={({ field }) => (
                          <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                        )}
                      />
                    </Form.Item>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {t("employee.province_auto_hint")}
                    </Typography.Text>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label={t("employee.f_foreign")}>
                      <Controller
                        name="is_foreign_posting"
                        control={control}
                        render={({ field }) => (
                          <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label={t("employee.f_hazard")}>
                      <Controller
                        name="is_hazardous_area"
                        control={control}
                        render={({ field }) => (
                          <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                        )}
                      />
                    </Form.Item>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {t("employee.province_auto_hint")}
                    </Typography.Text>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={t("employee.f_na")}>
                      <Controller
                        name="is_na_member"
                        control={control}
                        render={({ field }) => (
                          <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                        )}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              ),
            },
            {
              key: "4",
              label: t("employee.tabs.bank"),
              children: (
                <>
                  <Typography.Title level={5}>{t("employee.bank_section")}</Typography.Title>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Form.Item label={LABEL_REQ(t("employee.f_bank"))}>
                        <Controller
                          name="bank_name"
                          control={control}
                          render={({ field }) => (
                            <Select
                              {...field}
                              options={banks.map((b) => ({ label: b, value: b }))}
                              showSearch
                              style={{ width: "100%" }}
                              onChange={(v) => {
                                field.onChange(v);
                                setValue("bank_branch", "");
                              }}
                            />
                          )}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label={LABEL_REQ(t("employee.f_branch"))}>
                        <Controller
                          name="bank_branch"
                          control={control}
                          render={({ field }) => {
                            const v = field.value ? String(field.value) : "";
                            const branchOpts =
                              v && !branchNames.includes(v) ? [...branchNames, v] : branchNames;
                            return (
                            <Select
                              {...field}
                              loading={branchesLoading}
                              disabled={!bankNameWatch?.trim()}
                              options={branchOpts.map((b) => ({ label: b, value: b }))}
                              showSearch
                              optionFilterProp="label"
                              style={{ width: "100%" }}
                              placeholder={
                                bankNameWatch?.trim()
                                  ? t("employee.f_branch")
                                  : t("employee.select_bank_first")
                              }
                              status={errors.bank_branch ? "error" : undefined}
                            />
                            );
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label={t("employee.f_branch_code")}>
                        <Controller
                          name="bank_branch_code"
                          control={control}
                          render={({ field }) => <Input {...field} {...inputProps("bank_branch_code")} />}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label={LABEL_REQ(t("employee.f_account"))}>
                        <Controller
                          name="bank_account_no"
                          control={control}
                          render={({ field }) => <Input {...field} {...inputProps("bank_account_no")} />}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label={t("employee.f_swift")}>
                        <Controller
                          name="swift_code"
                          control={control}
                          render={({ field }) => <Input {...field} {...inputProps("swift_code")} />}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Divider />
                  <Typography.Title level={5}>{t("employee.family_section")}</Typography.Title>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Form.Item label={t("employee.f_spouse")}>
                        <Controller
                          name="has_spouse"
                          control={control}
                          render={({ field }) => (
                            <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                          )}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label={t("employee.f_children")}>
                        <Controller
                          name="eligible_children"
                          control={control}
                          render={({ field }) => (
                            <InputNumber
                              min={0}
                              max={3}
                              style={{ width: "100%" }}
                              value={field.value}
                              onChange={(v) => field.onChange(v ?? 0)}
                            />
                          )}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label={t("employee.f_field_allowance")}>
                        <Controller
                          name="field_allowance_type"
                          control={control}
                          render={({ field }) => (
                            <Select
                              {...field}
                              options={[
                                { label: t("employee.opt_prof_teaching"), value: "Teaching" },
                                { label: t("employee.opt_prof_medical"), value: "Medical" },
                                { label: t("employee.opt_prof_none"), value: "None" },
                              ]}
                              style={{ width: "100%" }}
                            />
                          )}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ),
            },
            {
              key: "5",
              label: t("employee.tabs.address"),
              children: (
                <Row gutter={[16, 16]}>
                  {(
                    [
                      ["house_no", "employee.f_house_no"],
                      ["street", "employee.f_street"],
                      ["area_baan", "employee.f_area_baan"],
                    ] as const
                  ).map(([name, labelKey]) => (
                    <Col xs={24} md={12} key={name}>
                      <Form.Item label={t(labelKey)}>
                        <Controller
                          name={name}
                          control={control}
                          render={({ field }) => <Input {...field} {...inputProps(name)} />}
                        />
                      </Form.Item>
                    </Col>
                  ))}
                  <Col xs={24} md={12}>
                    <Form.Item label={t("employee.f_province_of_residence")}>
                      <Controller
                        name="province_of_residence"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            allowClear
                            options={residenceProvinces.map((p) => ({ label: p, value: p }))}
                            showSearch
                            optionFilterProp="label"
                            style={{ width: "100%" }}
                            status={errors.province_of_residence ? "error" : undefined}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={t("employee.f_pin_code")}>
                      <Controller
                        name="pin_code"
                        control={control}
                        render={({ field }) => <Input {...field} {...inputProps("pin_code")} />}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={t("employee.f_residence_country")}>
                      <Controller
                        name="residence_country"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            allowClear
                            options={COUNTRY_OPTIONS.map((c) => ({ label: c, value: c }))}
                            showSearch
                            style={{ width: "100%" }}
                            status={errors.residence_country ? "error" : undefined}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              ),
            },
          ]}
        />

        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            background: "#FFFFFF",
            borderTop: "0.5px solid #DDE1EA",
            padding: "12px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <Typography.Text style={{ color: errCount ? "#E24B4A" : "transparent" }}>
            {errCount ? t("employee.fields_with_errors", { count: errCount }) : " "}
          </Typography.Text>
          <Space>
            <Button onClick={() => navigate(-1)}>{t("common.cancel")}</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={pending}
              style={{ background: "#1B3A6B", borderColor: "#1B3A6B" }}
            >
              {isEdit ? t("employee.save_changes") : t("employee.add_submit")}
            </Button>
          </Space>
        </div>
      </form>
    </div>
  );
}
