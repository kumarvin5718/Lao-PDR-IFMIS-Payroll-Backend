/** Screen: `LoginPage` — page-level UI and mutations. */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import axios, { isAxiosError } from "axios";
import { useState, type CSSProperties } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { API_BASE_URL, ROLES, ROUTES } from "@/config/constants";
import { useAuthStore } from "@/store/authStore";
import type { ApiEnvelope, LoginSuccessData } from "@/types/auth";

const loginSchema = z.object({
  username: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});

type LoginForm = z.infer<typeof loginSchema>;

const ROLE_KEYS = [
  "ROLE_EMPLOYEE",
  "ROLE_MANAGER",
  "ROLE_DEPT_OFFICER",
  "ROLE_ADMIN",
] as const;

function getApiErrorCode(err: unknown): string | undefined {
  if (
    isAxiosError(err) &&
    err.response?.data &&
    typeof err.response.data === "object" &&
    err.response.data !== null &&
    "error" in err.response.data
  ) {
    const e = (err.response.data as ApiEnvelope<null>).error;
    return e?.code;
  }
  return undefined;
}

function getApiErrorMessage(err: unknown): string | undefined {
  if (
    isAxiosError(err) &&
    err.response?.data &&
    typeof err.response.data === "object" &&
    err.response.data !== null &&
    "error" in err.response.data
  ) {
    const e = (err.response.data as ApiEnvelope<null>).error;
    return e?.message;
  }
  return undefined;
}

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);

  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: async (values: LoginForm) => {
      // Do not use apiClient: its auth interceptor may attach a stale Bearer token and break /auth/login.
      const { data } = await axios.post<ApiEnvelope<LoginSuccessData>>(
        `${API_BASE_URL}/api/v1/auth/login`,
        values,
        { withCredentials: true, headers: { "Content-Type": "application/json" } },
      );
      if (!data.success || !data.data) {
        throw new Error("Login failed");
      }
      return data.data;
    },
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      setUser({
        ...data.user,
        force_password_change: data.force_password_change,
      });
      if (data.force_password_change) {
        navigate("/change-password");
      } else {
        navigate(data.user.role === ROLES.ADMIN ? ROUTES.dashboard : ROUTES.employees);
      }
    },
  });

  const errCode = loginMutation.isError ? getApiErrorCode(loginMutation.error) : undefined;
  const errServerMsg = loginMutation.isError ? getApiErrorMessage(loginMutation.error) : undefined;
  const errorMessage = (() => {
    if (!loginMutation.isError) return "";
    if (errCode === "ERR_AUTH_INVALID_CREDENTIALS") return t("login.error.invalid_credentials");
    if (errCode === "ERR_AUTH_ACCOUNT_LOCKED") return t("login.error.account_locked");
    if (errCode === "ERR_INTERNAL") {
      return errServerMsg && errServerMsg !== "Unexpected error"
        ? errServerMsg
        : t("login.error.server_unavailable");
    }
    if (errServerMsg) return errServerMsg;
    return t("login.error.generic");
  })();

  const activeLang = i18n.language.startsWith("lo") ? "lo" : "en";

  const inputShell: CSSProperties = { position: "relative", width: "100%" };

  const inputStyle = (focused: boolean): CSSProperties => ({
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 12px 9px 34px",
    border: "0.5px solid #DDE1EA",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    background: focused ? "#FFFFFF" : "#FAFBFC",
    boxShadow: focused ? "0 0 0 2px #1B3A6B33" : "none",
  });

  const passwordInputStyle = (focused: boolean): CSSProperties => ({
    ...inputStyle(focused),
    paddingRight: 40,
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F7F8FA",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, marginBottom: "1.25rem", textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#1B3A6B",
            margin: "0 auto 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
            <circle cx="18" cy="18" r="14" stroke="#C9A84C" strokeWidth="2" />
            <circle cx="18" cy="18" r="8" fill="#C9A84C" opacity="0.2" />
            <path
              d="M18 8 L20 15 L27 15 L21.5 19.5 L23.5 26.5 L18 22
             L12.5 26.5 L14.5 19.5 L9 15 L16 15 Z"
              fill="#C9A84C"
            />
          </svg>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#7A8599",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {t("login.header_subtitle")}
        </div>
        <div style={{ fontSize: 18, color: "#1B3A6B", fontWeight: 500, marginBottom: 4 }}>
          {t("login.header_title")}
        </div>
        <div style={{ fontSize: 13, color: "#9BA5B7" }}>{t("login.header_system")}</div>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#FFFFFF",
          border: "0.5px solid #DDE1EA",
          borderRadius: 12,
          padding: "2rem",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: "#3D4A60", marginBottom: "1.25rem" }}>
          {t("login.subtitle")}
        </div>

        <form
          onSubmit={handleSubmit((vals) => {
            loginMutation.mutate(vals);
          })}
        >
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="login-username"
              style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}
            >
              {t("login.username")}
            </label>
            <div style={inputShell}>
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  display: "flex",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0v1H5v-1z"
                    fill="#9BA5B7"
                  />
                </svg>
              </span>
              <input
                id="login-username"
                autoComplete="username"
                {...register("username")}
                onFocus={() => setUsernameFocused(true)}
                onBlur={() => setUsernameFocused(false)}
                style={inputStyle(usernameFocused)}
              />
            </div>
            {errors.username && (
              <div style={{ fontSize: 12, color: "#E24B4A", marginTop: 4 }}>{errors.username.message}</div>
            )}
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="login-password"
              style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}
            >
              {t("login.password")}
            </label>
            <div style={inputShell}>
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  display: "flex",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M17 8h-1V6a5 5 0 00-10 0v2H5a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zm-8-2a3 3 0 016 0v2H9V6z"
                    fill="#9BA5B7"
                  />
                </svg>
              </span>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                {...register("password")}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                style={passwordInputStyle(passwordFocused)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                }}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 3l18 18M10.58 10.58A2 2 0 0012 15a2 2 0 002-2 0 2 0 00-.42-1.22M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 10 7-.26 1.36-1.04 2.58-2.17 3.58m-3.5-3.5A3 3 0 0012 9c-.74 0-1.42.27-1.95.73M6.36 6.36A10.07 10.07 0 003 12c.73 3.89 5 7 9 7 1.39 0 2.74-.25 4-.7m-7.1-7.1L3 3"
                      stroke="#9BA5B7"
                      strokeWidth="1.5"
                    />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
                      stroke="#9BA5B7"
                      strokeWidth="1.5"
                    />
                    <circle cx="12" cy="12" r="3" stroke="#9BA5B7" strokeWidth="1.5" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <div style={{ fontSize: 12, color: "#E24B4A", marginTop: 4 }}>{errors.password.message}</div>
            )}
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: 12, color: "#7A8599", marginBottom: 8 }}>{t("login.language_label")}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => void i18n.changeLanguage("en")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  background: activeLang === "en" ? "#1B3A6B" : "#FAFBFC",
                  color: activeLang === "en" ? "#FFFFFF" : "#7A8599",
                  border:
                    activeLang === "en" ? "1.5px solid #1B3A6B" : "0.5px solid #DDE1EA",
                }}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => void i18n.changeLanguage("lo")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  background: activeLang === "lo" ? "#1B3A6B" : "#FAFBFC",
                  color: activeLang === "lo" ? "#FFFFFF" : "#7A8599",
                  border:
                    activeLang === "lo" ? "1.5px solid #1B3A6B" : "0.5px solid #DDE1EA",
                }}
              >
                ລາວ
              </button>
            </div>
          </div>

          {loginMutation.isError && (
            <div
              style={{
                background: "#FFF0F0",
                borderLeft: "3px solid #E24B4A",
                borderRadius: 6,
                padding: "10px 12px",
                fontSize: 13,
                color: "#A32D2D",
                marginBottom: "1rem",
              }}
            >
              {errorMessage}
            </div>
          )}

          <div style={{ textAlign: "center", marginBottom: "1rem", fontSize: 13 }}>
            <Link to={ROUTES.register} style={{ color: "#1B3A6B", fontWeight: 500 }}>
              {t("register.registerLink")}
            </Link>
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            style={{
              width: "100%",
              padding: "10px",
              background: "#1B3A6B",
              color: "#FFFFFF",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: loginMutation.isPending ? "not-allowed" : "pointer",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: loginMutation.isPending ? 0.85 : 1,
            }}
          >
            {loginMutation.isPending && (
              <span
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid #FFFFFF",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "ifms-spin 0.7s linear infinite",
                }}
              />
            )}
            {loginMutation.isPending ? t("login.signing_in") : t("login.sign_in")}
          </button>
        </form>

        <div
          style={{
            borderTop: "0.5px solid #EEF0F5",
            margin: "1.5rem 0 1rem",
          }}
        />

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
          }}
        >
          {ROLE_KEYS.map((rk) => (
            <span
              key={rk}
              style={{
                fontSize: 11,
                padding: "3px 9px",
                borderRadius: 20,
                background: "#EEF2F9",
                color: "#3D5A8A",
              }}
            >
              {t(`roles.${rk}`)}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: "1.5rem",
          fontSize: 11,
          color: "#B0B8C8",
          textAlign: "center",
        }}
      >
        {t("login.footer")}
      </div>

      <style>{`@keyframes ifms-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
