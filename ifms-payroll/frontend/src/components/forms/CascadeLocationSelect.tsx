/** Form control: `CascadeLocationSelect` — lookups and cascades. */
import { Select, Space } from "antd";
import { useTranslation } from "react-i18next";

/** TODO: Country → Province → District cascading selects. */
export function CascadeLocationSelect() {
  const { t } = useTranslation();
  return (
    <Space>
      <Select placeholder={t("cascade.country")} style={{ minWidth: 160 }} disabled />
      <Select placeholder={t("cascade.province")} style={{ minWidth: 160 }} disabled />
      <Select placeholder={t("cascade.district")} style={{ minWidth: 160 }} disabled />
    </Space>
  );
}
