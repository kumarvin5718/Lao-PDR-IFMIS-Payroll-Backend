import { Select, Space } from "antd";

/** TODO: Ministry → Department → Division cascading selects (Section 5). */
export function CascadeMinistrySelect() {
  return (
    <Space>
      <Select placeholder="Ministry" style={{ minWidth: 200 }} disabled />
      <Select placeholder="Department" style={{ minWidth: 200 }} disabled />
      <Select placeholder="Division" style={{ minWidth: 200 }} disabled />
    </Space>
  );
}
