/** Shared UI: `PageHeader`. */
import { Breadcrumb, Typography } from "antd";

interface PageHeaderProps {
  title: string;
  breadcrumb?: { title: string; path?: string }[];
}

export function PageHeader({ title, breadcrumb }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      {breadcrumb?.length ? (
        <Breadcrumb
          items={breadcrumb.map((b) => ({
            title: b.title,
          }))}
        />
      ) : null}
      <Typography.Title level={3}>{title}</Typography.Title>
    </div>
  );
}
