import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { ROUTES } from "@/config/constants";

export function RegisterSuccessPage() {
  const { t } = useTranslation();

  return (
    <div style={{ maxWidth: 520, margin: "3rem auto", padding: "0 1rem", textAlign: "center" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>{t("register.successTitle")}</h1>
      <p style={{ fontSize: 15, color: "#3d4a60", lineHeight: 1.6, marginBottom: 32 }}>
        {t("register.successMessage")}
      </p>
      <Link
        to={ROUTES.login}
        style={{
          display: "inline-block",
          padding: "12px 24px",
          background: "#1B3A6B",
          color: "#fff",
          borderRadius: 8,
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        {t("register.backToLogin")}
      </Link>
    </div>
  );
}
