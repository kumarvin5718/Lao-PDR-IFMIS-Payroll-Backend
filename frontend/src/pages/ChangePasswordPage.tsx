import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { useMemo, useState, type CSSProperties } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { apiClient } from "@/api/client";
import { ROLES, ROUTES } from "@/config/constants";
import { useAuthStore } from "@/store/authStore";
import type { ApiEnvelope } from "@/types/auth";

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

export function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  const [oldFocused, setOldFocused] = useState(false);
  const [newFocused, setNewFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const schema = useMemo(
    () =>
      z
        .object({
          old_password: z.string().min(1),
          new_password: z.string().min(8, t("change_password.error.too_short")),
          confirm: z.string().min(1),
        })
        .refine((d) => d.new_password === d.confirm, {
          message: t("change_password.error.mismatch"),
          path: ["confirm"],
        }),
    [t],
  );

  type FormVals = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { old_password: "", new_password: "", confirm: "" },
  });

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

  const pwdStyle = (focused: boolean): CSSProperties => ({
    ...inputStyle(focused),
    paddingRight: 40,
  });

  const onSubmit = async (vals: FormVals) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const { data } = await apiClient.post<ApiEnvelope<{ message: string }>>(
        "/api/v1/auth/change-password",
        {
          old_password: vals.old_password,
          new_password: vals.new_password,
        },
      );
      if (!data.success) {
        setSubmitError(t("login.error.generic"));
        return;
      }
      if (user) {
        setUser({ ...user, force_password_change: false });
      }
      navigate(user?.role === ROLES.ADMIN ? ROUTES.dashboard : ROUTES.employees);
    } catch (e) {
      const code = getApiErrorCode(e);
      if (code === "ERR_AUTH_INVALID_CREDENTIALS") {
        setSubmitError(t("change_password.error.invalid_current"));
      } else if (code === "ERR_VALIDATION") {
        setSubmitError(t("change_password.error.too_short"));
      } else {
        setSubmitError(t("login.error.generic"));
      }
    } finally {
      setSubmitting(false);
    }
  };

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
        <div style={{ fontSize: 18, fontWeight: 500, color: "#1B3A6B", marginBottom: "1.25rem" }}>
          {t("change_password.title")}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
              {t("change_password.current")}
            </label>
            <div style={{ position: "relative", width: "100%" }}>
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17 8h-1V6a5 5 0 00-10 0v2H5a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zm-8-2a3 3 0 016 0v2H9V6z"
                    fill="#9BA5B7"
                  />
                </svg>
              </span>
              <input
                type={showOld ? "text" : "password"}
                autoComplete="current-password"
                {...register("old_password")}
                onFocus={() => setOldFocused(true)}
                onBlur={() => setOldFocused(false)}
                style={pwdStyle(oldFocused)}
              />
              <button
                type="button"
                onClick={() => setShowOld((s) => !s)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                {showOld ? (
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
            {errors.old_password && (
              <div style={{ fontSize: 12, color: "#E24B4A", marginTop: 4 }}>{errors.old_password.message}</div>
            )}
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
              {t("change_password.new")}
            </label>
            <div style={{ position: "relative", width: "100%" }}>
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17 8h-1V6a5 5 0 00-10 0v2H5a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zm-8-2a3 3 0 016 0v2H9V6z"
                    fill="#9BA5B7"
                  />
                </svg>
              </span>
              <input
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                {...register("new_password")}
                onFocus={() => setNewFocused(true)}
                onBlur={() => setNewFocused(false)}
                style={pwdStyle(newFocused)}
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                {showNew ? (
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
            {errors.new_password && (
              <div style={{ fontSize: 12, color: "#E24B4A", marginTop: 4 }}>{errors.new_password.message}</div>
            )}
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
              {t("change_password.confirm")}
            </label>
            <div style={{ position: "relative", width: "100%" }}>
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17 8h-1V6a5 5 0 00-10 0v2H5a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zm-8-2a3 3 0 016 0v2H9V6z"
                    fill="#9BA5B7"
                  />
                </svg>
              </span>
              <input
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                {...register("confirm")}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
                style={pwdStyle(confirmFocused)}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                {showConfirm ? (
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
            {errors.confirm && (
              <div style={{ fontSize: 12, color: "#E24B4A", marginTop: 4 }}>{errors.confirm.message}</div>
            )}
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
                marginBottom: "1rem",
              }}
            >
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "10px",
              background: "#1B3A6B",
              color: "#FFFFFF",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: submitting ? "not-allowed" : "pointer",
              border: "none",
            }}
          >
            {t("change_password.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
