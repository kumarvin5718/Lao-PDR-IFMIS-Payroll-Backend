/** Shared UI: `LanguageToggle`. */
import { Button, Space } from "antd";
import { useTranslation } from "react-i18next";

import { useUiStore } from "@/store/uiStore";

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const setLanguage = useUiStore((s) => s.setLanguage);

  function setLang(lng: string) {
    void i18n.changeLanguage(lng);
    document.documentElement.setAttribute("lang", lng);
    document.body.setAttribute("lang", lng);
    setLanguage(lng);
  }

  return (
    <Space>
      <Button size="small" type={i18n.language === "en" ? "primary" : "default"} onClick={() => setLang("en")}>
        EN
      </Button>
      <Button size="small" type={i18n.language === "lo" ? "primary" : "default"} onClick={() => setLang("lo")}>
        ລາວ
      </Button>
    </Space>
  );
}
