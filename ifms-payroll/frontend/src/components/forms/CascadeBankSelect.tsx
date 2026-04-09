/** Form control: `CascadeBankSelect` — lookups and cascades. */
import { Select, Space } from "antd";
import { useTranslation } from "react-i18next";

/** TODO: Bank → Branch cascading selects. */
export function CascadeBankSelect() {
  const { t } = useTranslation();
  return (
    <Space>
      <Select placeholder={t("cascade.bank")} style={{ minWidth: 200 }} disabled />
      <Select placeholder={t("cascade.branch")} style={{ minWidth: 200 }} disabled />
    </Space>
  );
}
