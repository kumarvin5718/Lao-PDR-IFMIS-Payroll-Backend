import {
  CloseOutlined,
  EditOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Dropdown,
  Grid,
  Input,
  message,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Table,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { apiClient } from "@/api/client";
import {
  deactivateEmployee,
  downloadEmployeeExport,
  fetchEmployees,
  type EmployeeListItem,
} from "@/api/employees";
import { ROLES } from "@/config/constants";
import { useJobPoller } from "@/hooks/useJobPoller";
import type { ApiEnvelope, UserOut } from "@/types/auth";
import { useAuthStore } from "@/store/authStore";

function canEditEmployee(row: EmployeeListItem, currentUser: UserOut | null): boolean {
  if (!currentUser) return false;
  if (currentUser.role === "ROLE_ADMIN") return true;
  if (currentUser.role === "ROLE_DEPT_OFFICER") return false;
  if (currentUser.role === "ROLE_MANAGER") {
    if (row.owner_role !== "ROLE_MANAGER") return true;
    if (row.uploaded_by_user_id === currentUser.user_id) return true;
    return false;
  }
  if (currentUser.role === "ROLE_EMPLOYEE") {
    if (row.uploaded_by_user_id === currentUser.user_id) return true;
    const ue = currentUser.email?.trim().toLowerCase();
    const re = row.email?.trim().toLowerCase();
    if (ue && re && ue === re) return true;
    return false;
  }
  return false;
}

const PAGE_SIZE = 50;
const INPUT_STYLE: React.CSSProperties = {
  border: "0.5px solid #DDE1EA",
  borderRadius: 8,
  background: "#FAFBFC",
  fontSize: 14,
  padding: "9px 12px 9px 34px",
};

const EMPLOYMENT_BADGE: Record<string, { bg: string; color: string }> = {
  Permanent: { bg: "#E8F5E9", color: "#2E7D32" },
  Probationary: { bg: "#FFF8E1", color: "#F57F17" },
  Contract: { bg: "#E3F2FD", color: "#1565C0" },
  Intern: { bg: "#F3E5F5", color: "#6A1B9A" },
};

async function fetchMinistryNames(): Promise<string[]> {
  const { data } = await apiClient.get<ApiEnvelope<unknown>>("/api/v1/master/org");
  if (!data.success || data.data == null) return [];
  const d = data.data;
  if (Array.isArray(d)) {
    if (d.length === 0) return [];
    if (typeof d[0] === "string") return d as string[];
    return (d as { ministry_name?: string }[])
      .map((x) => x.ministry_name)
      .filter((x): x is string => Boolean(x));
  }
  if (d && typeof d === "object" && "ministries" in d) {
    const m = (d as { ministries: unknown }).ministries;
    if (Array.isArray(m)) return m.map(String);
  }
  return [];
}

export function EmployeeListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pollJob } = useJobPoller();
  const user = useAuthStore((s) => s.user);
  const screens = Grid.useBreakpoint();
  const showMinistryCol = screens.md !== false;

  const [searchParams, setSearchParams] = useSearchParams();
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") ?? "");

  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? String(PAGE_SIZE)) || PAGE_SIZE));
  const searchRaw = searchParams.get("search") ?? "";
  const ministry = searchParams.get("ministry") ?? "";
  const gradeRaw = searchParams.get("grade");
  const grade = gradeRaw ? Number(gradeRaw) : undefined;
  const employmentType = searchParams.get("employment_type") ?? "";
  const statusFilter = searchParams.get("status") ?? "active";

  useEffect(() => {
    const tmr = window.setTimeout(() => {
      setDebouncedSearch(searchRaw);
    }, 400);
    return () => window.clearTimeout(tmr);
  }, [searchRaw]);

  const isActiveParam: boolean | undefined =
    statusFilter === "all" ? undefined : statusFilter === "inactive" ? false : true;

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: debouncedSearch.trim().length >= 2 ? debouncedSearch.trim() : undefined,
      ministry: ministry || undefined,
      grade: grade !== undefined && !Number.isNaN(grade) ? grade : undefined,
      employment_type: employmentType || undefined,
      is_active: isActiveParam,
    }),
    [page, limit, debouncedSearch, ministry, grade, employmentType, isActiveParam],
  );

  const exportFilterParams = useMemo(
    () => ({
      search: debouncedSearch.trim().length >= 2 ? debouncedSearch.trim() : undefined,
      ministry: ministry || undefined,
      grade: grade !== undefined && !Number.isNaN(grade) ? grade : undefined,
      employment_type: employmentType || undefined,
      is_active: isActiveParam,
    }),
    [debouncedSearch, ministry, grade, employmentType, isActiveParam],
  );

  const runExport = useCallback(
    async (format: "xlsx" | "pdf") => {
      const key = `emp-export-${format}`;
      try {
        message.loading({ content: t("employee.export_started"), key, duration: 0 });
        const result = await downloadEmployeeExport({ format, ...exportFilterParams });
        if (result.kind === "file") {
          const url = URL.createObjectURL(result.blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = result.filename;
          a.click();
          URL.revokeObjectURL(url);
          message.success({ content: t("employee.export_ready"), key });
          return;
        }
        await pollJob(
          result.jobId,
          async (jobResult) => {
            const name = jobResult.file_path.split("/").pop() || "employees_export.xlsx";
            const { data: blob } = await apiClient.get(`/api/v1/reports/download/${encodeURIComponent(name)}`, {
              responseType: "blob",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
          },
          { intervalMs: 3000 },
        );
        message.success({ content: t("employee.export_ready"), key });
      } catch (e) {
        const detail = e instanceof Error ? e.message : "";
        message.error({
          content: detail ? `${t("audit.exportFailed")}: ${detail}` : t("audit.exportFailed"),
          key,
        });
      }
    },
    [exportFilterParams, pollJob, t],
  );

  const { data, isFetching, isError } = useQuery({
    queryKey: ["employees", queryParams],
    queryFn: async () => {
      const res = await fetchEmployees(queryParams);
      if (!res.success || res.data === null) {
        throw new Error(res.error?.message ?? "Failed to load employees");
      }
      return res;
    },
    staleTime: 30_000,
  });

  const { data: ministryOptions = [] } = useQuery({
    queryKey: ["master", "org", "ministries"],
    queryFn: fetchMinistryNames,
    staleTime: 60_000,
  });

  const items = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(updates).forEach(([k, v]) => {
            if (v === null || v === "") next.delete(k);
            else next.set(k, v);
          });
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const anyFilter =
    searchRaw.trim().length > 0 ||
    ministry !== "" ||
    gradeRaw !== null ||
    employmentType !== "" ||
    statusFilter !== "active";

  const showMinistryFilter = user?.role === "ROLE_ADMIN";

  const showBulkUpload =
    user?.role === "ROLE_MANAGER" || user?.role === "ROLE_ADMIN";

  const showExport = user?.role === ROLES.MANAGER || user?.role === ROLES.ADMIN;

  const showAddEmployee = user?.role !== "ROLE_EMPLOYEE";

  const handleDeactivate = useCallback(
    async (code: string) => {
      const res = await deactivateEmployee(code);
      if (!res.success) {
        message.error(res.error?.message ?? t("employee.errors.generic"));
        return;
      }
      message.success(t("employee.deactivated_success"));
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    [queryClient, t],
  );

  const columns: ColumnsType<EmployeeListItem> = useMemo(
    () => [
      {
        title: t("employee.col_code", { defaultValue: "Code" }),
        dataIndex: "employee_code",
        key: "employee_code",
        width: 110,
        sorter: (a, b) => a.employee_code.localeCompare(b.employee_code),
      },
      {
        title: t("employee.col_name", { defaultValue: "Name" }),
        dataIndex: "full_name",
        key: "full_name",
        render: (text: string, record) => (
          <Link to={`/employees/${record.employee_code}/edit`} style={{ color: "#1B3A6B" }}>
            {text}
          </Link>
        ),
      },
      ...(showMinistryCol
        ? [
            {
              title: t("employee.col_ministry", { defaultValue: "Ministry" }),
              dataIndex: "ministry_name",
              key: "ministry_name",
              ellipsis: true,
            },
          ]
        : []),
      {
        title: t("employee.col_grade", { defaultValue: "Grade / Step" }),
        key: "gs",
        width: 100,
        render: (_, r) => `G${r.grade} / S${r.step}`,
      },
      {
        title: t("employee.col_position", { defaultValue: "Position" }),
        dataIndex: "position_title",
        key: "position_title",
        ellipsis: true,
        width: 180,
      },
      {
        title: t("employee.col_type", { defaultValue: "Type" }),
        dataIndex: "employment_type",
        key: "employment_type",
        render: (et: string) => {
          const st = EMPLOYMENT_BADGE[et] ?? { bg: "#EEF2F9", color: "#3D5A8A" };
          return (
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 12,
                background: st.bg,
                color: st.color,
              }}
            >
              {et}
            </span>
          );
        },
      },
      {
        title: t("employee.col_status", { defaultValue: "Status" }),
        dataIndex: "is_active",
        key: "is_active",
        render: (active: boolean) => (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: active ? "#2E7D32" : "#9E9E9E",
              }}
            />
            {active ? "Active" : "Inactive"}
          </span>
        ),
      },
      {
        title: t("employee.col_actions", { defaultValue: "Actions" }),
        key: "actions",
        width: 100,
        render: (_, record) => {
          const canEdit = canEditEmployee(record, user);
          const editBtn = (
            <Button
              type="text"
              icon={<EditOutlined />}
              aria-label="Edit"
              disabled={!canEdit}
              onClick={() => navigate(`/employees/${record.employee_code}/edit`)}
            />
          );
          return (
          <Space>
            {!canEdit ? (
              <Tooltip title="You do not have permission to edit this record">
                <span>{editBtn}</span>
              </Tooltip>
            ) : (
              editBtn
            )}
            <Popconfirm
              title={t("employee.deactivate_confirm", { name: record.full_name })}
              okText={t("employee.deactivate_btn", { defaultValue: "Deactivate" })}
              okButtonProps={{ danger: true }}
              onConfirm={() => void handleDeactivate(record.employee_code)}
            >
              <Button type="text" danger icon={<CloseOutlined />} aria-label="Deactivate" />
            </Popconfirm>
          </Space>
          );
        },
      },
    ],
    [handleDeactivate, navigate, showMinistryCol, t, user],
  );

  if (isError) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Text type="danger">{t("employee.errors.generic")}</Typography.Text>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 24px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0, color: "#1B3A6B" }}>
          {t("page.employees.list.title")}
        </Typography.Title>
        <Space>
          {showExport && (
            <Dropdown
              menu={{
                items: [
                  {
                    key: "xlsx",
                    icon: <FileExcelOutlined style={{ color: "#52c41a" }} />,
                    label: t("employee.export_excel"),
                    onClick: () => void runExport("xlsx"),
                  },
                  {
                    key: "pdf",
                    icon: <FilePdfOutlined style={{ color: "#ff4d4f" }} />,
                    label: t("employee.export_pdf"),
                    onClick: () => void runExport("pdf"),
                  },
                ],
              }}
            >
              <Button>{t("employee.export")}</Button>
            </Dropdown>
          )}
          {showBulkUpload && (
            <Button
              icon={<UploadOutlined />}
              onClick={() => navigate("/employees/bulk-upload")}
              style={{
                borderColor: "#1B3A6B",
                color: "#1B3A6B",
                background: "#FFFFFF",
              }}
            >
              {t("common.bulk_upload")}
            </Button>
          )}
          {showAddEmployee && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/employees/new")}
              style={{ background: "#1B3A6B", borderColor: "#1B3A6B" }}
            >
              {t("employee.add_employee", { defaultValue: "Add Employee" })}
            </Button>
          )}
        </Space>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ position: "relative", width: 280 }}>
          <SearchOutlined
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9BA5B7",
              zIndex: 1,
            }}
          />
          <Input
            allowClear
            placeholder={t("employee.search_placeholder")}
            value={searchRaw}
            onChange={(e) => {
              setParam({ search: e.target.value || null, page: "1" });
            }}
            style={INPUT_STYLE}
          />
        </div>

        {showMinistryFilter && (
          <Select
            allowClear
            placeholder={t("employee.filter_ministry", { defaultValue: "Ministry" })}
            style={{ minWidth: 180 }}
            value={ministry || undefined}
            options={ministryOptions.map((m) => ({ label: m, value: m }))}
            onChange={(v) => setParam({ ministry: v ?? null, page: "1" })}
          />
        )}

        <Select
          allowClear
          placeholder={t("employee.filter_grade", { defaultValue: "Grade" })}
          style={{ width: 100 }}
          value={gradeRaw ?? undefined}
          options={Array.from({ length: 10 }, (_, i) => i + 1).map((g) => ({
            label: String(g),
            value: String(g),
          }))}
          onChange={(v) => setParam({ grade: v ?? null, page: "1" })}
        />

        <Select
          allowClear
          placeholder={t("employee.filter_employment", { defaultValue: "Employment" })}
          style={{ minWidth: 160 }}
          value={employmentType || undefined}
          options={["Permanent", "Probationary", "Contract", "Intern"].map((x) => ({
            label: x,
            value: x,
          }))}
          onChange={(v) => setParam({ employment_type: v ?? null, page: "1" })}
        />

        <div style={{ display: "flex", gap: 8 }}>
          {(["active", "inactive", "all"] as const).map((k) => {
            const active = statusFilter === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setParam({ status: k === "active" ? null : k, page: "1" })}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  background: active ? "#1B3A6B" : "#FAFBFC",
                  color: active ? "#FFFFFF" : "#7A8599",
                  border: active ? "1.5px solid #1B3A6B" : "0.5px solid #DDE1EA",
                }}
              >
                {k === "active"
                  ? t("employee.status_active", { defaultValue: "Active" })
                  : k === "inactive"
                    ? t("employee.status_inactive", { defaultValue: "Inactive" })
                    : t("employee.status_all", { defaultValue: "All" })}
              </button>
            );
          })}
        </div>

        {anyFilter && (
          <Typography.Link
            onClick={() => {
              setSearchParams(new URLSearchParams({ page: "1", limit: String(PAGE_SIZE) }), {
                replace: true,
              });
            }}
          >
            {t("employee.clear_filters", { defaultValue: "Clear filters" })}
          </Typography.Link>
        )}
      </div>

      <div style={{ fontSize: 13, color: "#7A8599", marginBottom: 12 }}>
        {t("employee.showing", { from, to, total })}
      </div>

      {isFetching ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : items.length === 0 && debouncedSearch.trim().length >= 2 ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <svg width="120" height="80" viewBox="0 0 120 80" style={{ marginBottom: 16 }}>
            <circle cx="50" cy="28" r="14" fill="none" stroke="#1B3A6B" strokeWidth="2" />
            <path
              d="M30 65 Q50 45 70 65"
              fill="none"
              stroke="#7A8599"
              strokeWidth="2"
            />
            <circle cx="88" cy="38" r="16" fill="none" stroke="#9BA5B7" strokeWidth="2" />
            <line x1="96" y1="46" x2="108" y2="58" stroke="#1B3A6B" strokeWidth="2" />
          </svg>
          <Typography.Text style={{ color: "#7A8599" }}>{t("employee.no_results")}</Typography.Text>
        </div>
      ) : (
        <Table<EmployeeListItem>
          rowKey="employee_code"
          columns={columns}
          dataSource={items}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: false,
            showTotal: (tot) => `${tot} employees`,
            onChange: (p) => setParam({ page: String(p) }),
          }}
        />
      )}
    </div>
  );
}
