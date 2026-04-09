/** Form control: `CascadeMinistrySelect` — lookups and cascades. */
import { Select, Space } from "antd";
import { useTranslation } from "react-i18next";

/** TODO: Ministry → Department → Division cascading selects (Section 5). */
export function CascadeMinistrySelect() {
  const { t } = useTranslation();
  return (
    <Space>
      <Select placeholder={t("cascade.ministry")} style={{ minWidth: 200 }} disabled />
      <Select placeholder={t("cascade.department")} style={{ minWidth: 200 }} disabled />
      <Select placeholder={t("cascade.division")} style={{ minWidth: 200 }} disabled />
    </Space>
  );
}
