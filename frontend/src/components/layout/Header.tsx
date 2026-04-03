import { Layout, Space, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { LanguageToggle } from "@/components/common/LanguageToggle";
import { logout } from "@/api/auth";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";

const { Header: AntHeader } = Layout;

export function HeaderBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const clear = useAuthStore((s) => s.clear);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clear();
      navigate("/login", { replace: true });
    }
  };

  return (
    <AntHeader style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Typography.Text strong>IFMS Payroll</Typography.Text>
      <Space>
        <LanguageToggle />
        <Typography.Text>{user?.full_name}</Typography.Text>
        <Typography.Link onClick={() => void handleLogout()}>{t("common.logout")}</Typography.Link>
      </Space>
    </AntHeader>
  );
}
