/** Shared UI: `StatusBadge`. */
import { Tag } from "antd";

const COLORS: Record<string, string> = {
  Active: "green",
  Inactive: "default",
  Pending: "gold",
  Locked: "red",
};

export function StatusBadge({ status }: { status: string }) {
  return <Tag color={COLORS[status] ?? "blue"}>{status}</Tag>;
}
