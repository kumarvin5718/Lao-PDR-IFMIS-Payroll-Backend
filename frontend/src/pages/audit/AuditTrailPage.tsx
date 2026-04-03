import { DownloadOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  DatePicker,
  Grid,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiClient } from "@/api/client";
import { exportAuditLog, useAuditLog, type AuditLogParams, type AuditLogRow } from "@/api/audit";
import { useJobPoller } from "@/hooks/useJobPoller";

const { RangePicker } = DatePicker;

const TABLE_COLORS: Record<string, string> = {
  lk_org_master: "blue",
  lk_location_master: "green",
  lk_bank_master: "gold",
  lk_grade_step: "purple",
  lk_grade_derivation: "magenta",
  lk_allowance_rates: "orange",
  lk_pit_brackets: "red",
  payroll_monthly: "geekblue",
  employee: "cyan",
};

const AUDITABLE_TABLES = Object.keys(TABLE_COLORS);

export function AuditTrailPage() {
  const { t } = useTranslation();
  const screens = Grid.useBreakpoint();
  const showWideFilters = screens.md !== false;

  const [params, setParams] = useState<AuditLogParams>({ page: 1, limit: 100 });
  const [pending, setPending] = useState<{
    table?: string;
    from?: string;
    to?: string;
    changed_by?: string;
    circular_ref?: string;
  }>({});

  const { pollJob } = useJobPoller();

  const { data: envelope, isFetching, refetch } = useAuditLog(params);
  const rows = envelope?.data ?? [];
  const total = envelope?.pagination?.total ?? 0;

  const dateRange = useMemo((): [Dayjs, Dayjs] | null => {
    if (pending.from && pending.to) {
      return [dayjs(pending.from), dayjs(pending.to)];
    }
    return null;
  }, [pending.from, pending.to]);

  const applyFilters = () => {
    setParams({
      page: 1,
      limit: params.limit ?? 100,
      table: pending.table || undefined,
      from: pending.from || undefined,
      to: pending.to || undefined,
      changed_by: pending.changed_by?.trim() || undefined,
      circular_ref: pending.circular_ref?.trim() || undefined,
    });
  };

  const resetFilters = () => {
    setPending({});
    setParams({ page: 1, limit: 100 });
  };

  const handleExport = async () => {
    try {
      const { job_id } = await exportAuditLog(params);
      message.loading({
        content: t("audit.exportStarted"),
        key: "audit-export",
        duration: 0,
      });
      await pollJob(job_id, async (result) => {
        const name = result.file_path.split("/").pop() || "audit_export.xlsx";
        const { data: blob } = await apiClient.get(`/api/v1/reports/download/${encodeURIComponent(name)}`, {
          responseType: "blob",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      });
      message.success({ content: t("audit.exportReady"), key: "audit-export" });
    } catch {
      message.error({ content: t("audit.exportFailed"), key: "audit-export" });
    }
  };

  const columns: ColumnsType<AuditLogRow> = [
    {
      title: t("audit.id"),
      dataIndex: "id",
      width: 72,
      fixed: "left",
    },
    {
      title: t("audit.table"),
      dataIndex: "table_name",
      width: 160,
      render: (name: string) => (
        <Tag color={TABLE_COLORS[name] ?? "default"}>{name}</Tag>
      ),
    },
    {
      title: t("audit.rowKey"),
      dataIndex: "row_key",
      ellipsis: true,
      render: (v: string) => (
        <Tooltip title={v}>
          <span>{v}</span>
        </Tooltip>
      ),
    },
    {
      title: t("audit.field"),
      dataIndex: "field_name",
      width: 120,
    },
    {
      title: t("audit.oldValue"),
      dataIndex: "old_value",
      ellipsis: true,
      render: (v: string | null) => v ?? "—",
    },
    {
      title: t("audit.newValue"),
      dataIndex: "new_value",
      ellipsis: true,
      render: (v: string | null) => v ?? "—",
    },
    {
      title: t("audit.changedBy"),
      dataIndex: "changed_by",
      width: 120,
    },
    {
      title: t("audit.changedAt"),
      dataIndex: "changed_at",
      width: 180,
      render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      title: t("audit.circularRef"),
      dataIndex: "circular_ref",
      width: 120,
      ellipsis: true,
      responsive: ["lg"],
      render: (v: string | null) => v ?? "—",
    },
    {
      title: t("audit.remarks"),
      dataIndex: "change_remarks",
      ellipsis: true,
      responsive: ["lg"],
      render: (v: string | null) => v ?? "—",
    },
  ];

  return (
    <div style={{ padding: "0 0 24px" }}>
      <Typography.Title level={4} style={{ color: "#1B3A6B" }}>
        {t("audit.title")}
      </Typography.Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Space wrap size="middle" style={{ width: "100%" }}>
            <Select
              allowClear
              placeholder={t("audit.filterTable")}
              style={{ minWidth: showWideFilters ? 200 : "100%" }}
              value={pending.table}
              options={AUDITABLE_TABLES.map((tb) => ({ label: tb, value: tb }))}
              onChange={(v) => setPending((p) => ({ ...p, table: v ?? undefined }))}
            />
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (!dates || !dates[0] || !dates[1]) {
                  setPending((p) => ({ ...p, from: undefined, to: undefined }));
                  return;
                }
                setPending((p) => ({
                  ...p,
                  from: dates[0]!.format("YYYY-MM-DD"),
                  to: dates[1]!.format("YYYY-MM-DD"),
                }));
              }}
              style={{ minWidth: showWideFilters ? 280 : "100%" }}
            />
            <Input
              allowClear
              placeholder={t("audit.filterChangedBy")}
              style={{ maxWidth: showWideFilters ? 200 : "100%" }}
              value={pending.changed_by}
              onChange={(e) => setPending((p) => ({ ...p, changed_by: e.target.value }))}
            />
            <Input
              allowClear
              placeholder={t("audit.filterCircularRef")}
              style={{ maxWidth: showWideFilters ? 200 : "100%" }}
              value={pending.circular_ref}
              onChange={(e) => setPending((p) => ({ ...p, circular_ref: e.target.value }))}
            />
          </Space>
          <Space wrap>
            <Button type="primary" icon={<SearchOutlined />} onClick={applyFilters}>
              {t("audit.applyFilters")}
            </Button>
            <Button onClick={resetFilters}>{t("audit.resetFilters")}</Button>
            <Button icon={<ReloadOutlined />} onClick={() => void refetch()}>
              {t("common.search")}
            </Button>
            <Button type="default" icon={<DownloadOutlined />} onClick={() => void handleExport()}>
              {t("audit.exportXlsx")}
            </Button>
          </Space>
        </Space>
      </Card>

      <Card size="small">
        <Table<AuditLogRow>
          rowKey={(r) => String(r.id)}
          loading={isFetching}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1200 }}
          pagination={{
            current: params.page,
            pageSize: params.limit,
            total,
            showSizeChanger: true,
            pageSizeOptions: [50, 100, 200],
            onChange: (page, pageSize) => {
              setParams((prev) => ({
                ...prev,
                page,
                limit: pageSize ?? prev.limit,
              }));
            },
          }}
        />
        <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
          {t("audit.hintReadonly")}
        </Typography.Text>
      </Card>
    </div>
  );
}
