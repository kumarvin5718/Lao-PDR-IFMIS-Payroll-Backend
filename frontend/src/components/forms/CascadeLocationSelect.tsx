import { Select, Space } from "antd";

/** TODO: Country → Province → District cascading selects. */
export function CascadeLocationSelect() {
  return (
    <Space>
      <Select placeholder="Country" style={{ minWidth: 160 }} disabled />
      <Select placeholder="Province" style={{ minWidth: 160 }} disabled />
      <Select placeholder="District" style={{ minWidth: 160 }} disabled />
    </Space>
  );
}
