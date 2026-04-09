/** Screen: `RegisterPage` — page-level UI and mutations. */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { API_BASE_URL, ROUTES } from "@/config/constants";
import type { ApiEnvelope } from "@/types/auth";

function buildRegisterSchema(t: TFunction) {
  return z.object({
    sso_number: z.string().min(1).regex(/^SSO\d{7}$/, t("register.validationSsoFormat")),
    full_name: z.string().min(2),
    email: z.string().email().refine((v) => v.toLowerCase().endsWith("@gov.la"), {
      message: t("register.validationEmailGov"),
    }),
    phone_number: z.string().optional(),
    location: z.string().min(1),
    department_name: z.string().min(1),
  });
}

type RegisterForm = z.infer<ReturnType<typeof buildRegisterSchema>>;

type DupEnvelope = ApiEnvelope<{ is_duplicate: boolean; existing_code: string | null }>;

async function checkDuplicate(field: string, value: string) {
  const { data } = await axios.get<DupEnvelope>(`${API_BASE_URL}/api/v1/employees/check-duplicate`, {
    params: { field, value: value.trim() },
  });
  if (!data.success || data.data === null) throw new Error("check failed");
  return data.data;
}

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const registerSchema = useMemo(() => buildRegisterSchema(t), [t]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      sso_number: "",
      full_name: "",
      email: "",
      phone_number: "",
      location: "",
      department_name: "",
    },
  });

  const location = watch("location");

  const provincesQuery = useQuery({
    queryKey: ["lookups", "provinces"],
    queryFn: async () => {
      const { data } = await axios.get<ApiEnvelope<string[]>>(`${API_BASE_URL}/api/v1/lookups/provinces`);
      if (!data.success || data.data === null) throw new Error("provinces");
      return data.data;
    },
  });

  const departmentsQuery = useQuery({
    queryKey: ["lookups", "departments", location],
    queryFn: async () => {
      const { data } = await axios.get<ApiEnvelope<string[]>>(
        `${API_BASE_URL}/api/v1/lookups/departments`,
        { params: location ? { location } : {} },
      );
      if (!data.success || data.data === null) throw new Error("departments");
      return data.data;
    },
    enabled: Boolean(location),
  });

  const provinceOptions = useMemo(() => provincesQuery.data ?? [], [provincesQuery.data]);
  const departmentOptions = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);

  const registerMutation = useMutation({
    mutationFn: async (body: RegisterForm) => {
      const { data } = await axios.post<ApiEnvelope<{ message: string; employee_code: string }>>(
        `${API_BASE_URL}/api/v1/auth/register`,
        {
          sso_number: body.sso_number,
          full_name: body.full_name.trim(),
          email: body.email.trim(),
          phone_number: body.phone_number?.trim() || null,
          location: body.location,
          department_name: body.department_name,
        },
      );
      if (!data.success || data.data === null) throw new Error("register failed");
      return data.data;
    },
    onSuccess: () => {
      navigate(ROUTES.registerSuccess);
    },
  });

  const onBlurSso = async () => {
    const v = watch("sso_number").trim();
    if (!/^SSO\d{7}$/.test(v)) {
      setSsoError(null);
      return;
    }
    try {
      const d = await checkDuplicate("sso_number", v);
      if (d.is_duplicate && d.existing_code) {
        setSsoError(t("register.duplicateSso", { code: d.existing_code }));
      } else {
        setSsoError(null);
      }
    } catch {
      setSsoError(null);
    }
  };

  const onBlurEmail = async () => {
    const v = watch("email").trim();
    if (!v.toLowerCase().endsWith("@gov.la")) {
      setEmailError(null);
      return;
    }
    try {
      const d = await checkDuplicate("email", v);
      if (d.is_duplicate) {
        setEmailError(t("register.duplicateEmail"));
      } else {
        setEmailError(null);
      }
    } catch {
      setEmailError(null);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>{t("register.title")}</h1>
      <p style={{ marginBottom: "1.5rem", fontSize: 14, color: "#5a6578" }}>
        <Link to={ROUTES.login}>{t("register.loginLink")}</Link>
      </p>

      <form
        onSubmit={handleSubmit((vals) => {
          setSsoError(null);
          setEmailError(null);
          registerMutation.mutate(vals);
        })}
      >
        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>{t("register.ssoNumber")}</label>
        <input
          {...register("sso_number")}
          onBlur={() => void onBlurSso()}
          placeholder={t("register.ssoPlaceholder")}
          style={{ width: "100%", padding: 10, marginBottom: 8, borderRadius: 8, border: "1px solid #dde1ea" }}
        />
        {(errors.sso_number || ssoError) && (
          <div style={{ color: "#E24B4A", fontSize: 12, marginBottom: 8 }}>{ssoError || errors.sso_number?.message}</div>
        )}

        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>{t("register.fullName")}</label>
        <input
          {...register("full_name")}
          style={{ width: "100%", padding: 10, marginBottom: 8, borderRadius: 8, border: "1px solid #dde1ea" }}
        />
        {errors.full_name && (
          <div style={{ color: "#E24B4A", fontSize: 12, marginBottom: 8 }}>{errors.full_name.message}</div>
        )}

        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>{t("register.email")}</label>
        <input
          type="email"
          {...register("email")}
          onBlur={() => void onBlurEmail()}
          style={{ width: "100%", padding: 10, marginBottom: 8, borderRadius: 8, border: "1px solid #dde1ea" }}
        />
        {(errors.email || emailError) && (
          <div style={{ color: "#E24B4A", fontSize: 12, marginBottom: 8 }}>{emailError || errors.email?.message}</div>
        )}

        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>{t("register.phone")}</label>
        <input
          {...register("phone_number")}
          style={{ width: "100%", padding: 10, marginBottom: 8, borderRadius: 8, border: "1px solid #dde1ea" }}
        />

        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>{t("register.location")}</label>
        <select
          {...register("location", {
            onChange: () => {
              setValue("department_name", "");
            },
          })}
          style={{ width: "100%", padding: 10, marginBottom: 8, borderRadius: 8, border: "1px solid #dde1ea" }}
        >
          <option value="">{t("register.selectProvince")}</option>
          {provinceOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {errors.location && (
          <div style={{ color: "#E24B4A", fontSize: 12, marginBottom: 8 }}>{errors.location.message}</div>
        )}

        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>{t("register.department")}</label>
        <select
          {...register("department_name")}
          disabled={!location}
          style={{ width: "100%", padding: 10, marginBottom: 8, borderRadius: 8, border: "1px solid #dde1ea" }}
        >
          <option value="">{location ? t("register.selectDepartment") : "—"}</option>
          {departmentOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {errors.department_name && (
          <div style={{ color: "#E24B4A", fontSize: 12, marginBottom: 8 }}>{errors.department_name.message}</div>
        )}

        {registerMutation.isError && (
          <div style={{ color: "#E24B4A", fontSize: 13, marginBottom: 12 }}>{t("login.error.generic")}</div>
        )}

        <button
          type="submit"
          disabled={registerMutation.isPending}
          style={{
            width: "100%",
            padding: "12px",
            background: "#1B3A6B",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 500,
            cursor: registerMutation.isPending ? "not-allowed" : "pointer",
          }}
        >
          {t("register.submit")}
        </button>
      </form>
    </div>
  );
}
