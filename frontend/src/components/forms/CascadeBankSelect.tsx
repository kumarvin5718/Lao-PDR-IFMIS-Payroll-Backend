import { Select, Space } from "antd";

/** TODO: Bank → Branch cascading selects. */
export function CascadeBankSelect() {
  return (
    <Space>
      <Select placeholder="Bank" style={{ minWidth: 200 }} disabled />
      <Select placeholder="Branch" style={{ minWidth: 200 }} disabled />
    </Space>
  );
}
