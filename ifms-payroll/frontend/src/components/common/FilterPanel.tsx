/** Shared UI: `FilterPanel`. */
import { Card } from "antd";
import type { ReactNode } from "react";

export function FilterPanel({ children }: { children: ReactNode }) {
  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      {children}
    </Card>
  );
}
