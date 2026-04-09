/** Screen: `PayrollMonthlyPage` — page-level UI and mutations. */
import { EditOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  DatePicker,
  Drawer,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { isAxiosError } from "axios";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { apiClient } from "@/api/client";
import {
  approvePayroll,
  fetchPayroll,
  lockPayroll,
  patchFreeFields,
  runPayroll,
  unlockPayroll,
  waitForPayrollRunJob,
  type PayrollMonthlyRow,
} from "@/api/payroll";
import type { ApiEnvelope } from "@/types/auth";
import { ROUTES, ROLES } from "@/config/constants";
import { useAuthStore } from "@/store/authStore";

const NAVY = "#1B3A6B";

async function fetchMinistryNames(): Promise<string[]> {
  const { data } = await apiClient.get<
    ApiEnvelope<Array<{ ministry_key: string; ministry_name: string }>>
  >("/api/v1/lookups/ministries");
  if (!data.success || data.data == null) return [];
  return data.data.map((x) => x.ministry_name).filter((x): x is string => Boolean(x));
}

type FreeForm = {
  free_allowance_1: number;
  free_allowance_2: number;
  free_allowance_3: number;
  free_deduction_1: number;
  free_deduction_2: number;
};

export function PayrollMonthlyPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const screens = Grid.useBreakpoint();
  const showMinistryCol = screens.md !== false;

  const [month, setMonth] = useState<Dayjs>(() => dayjs().startOf("month"));
  const [ministry, setMinistry] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [runOpen, setRunOpen] = useState(false);
  const [runMinistry, setRunMinistry] = useState<string | undefined>(undefined);
  /** Run modal: payroll job phase for async Celery path. */
  const [runJobPhase, setRunJobPhase] = useState<"idle" | "submitting" | "queued" | "running">("idle");
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editRow, setEditRow] = useState<PayrollMonthlyRow | null>(null);
  const [drawerErr, setDrawerErr] = useState<string | null>(null);

  const monthStr = month.format("YYYY-MM");

  const showMinistryFilter = user?.role === ROLES.ADMIN;
  const showRun = user?.role === ROLES.MANAGER || user?.role === ROLES.ADMIN;
  const isFinancePlus = user?.role === ROLES.MANAGER || user?.role === ROLES.ADMIN;
  const canEditFree = isFinancePlus;
  const canLock = user?.role === ROLES.ADMIN;
  const canUnlock = user?.role === ROLES.ADMIN;
  const showSummary = user?.role === ROLES.MANAGER || user?.role === ROLES.ADMIN;

  const { data: ministryOptions = [] } = useQuery({
    queryKey: ["lookups", "ministries"],
    queryFn: fetchMinistryNames,
    staleTime: 60_000,
  });

  const queryParams = useMemo(
    () => ({
      month: monthStr,
      ministry: ministry || undefined,
      page,
      limit: pageSize,
      status: statusFilter || undefined,
    }),
    [monthStr, ministry, page, statusFilter],
  );

  const payrollQuery = useQuery({
    queryKey: ["payroll", "monthly", queryParams],
    queryFn: async () => {
      const res = await fetchPayroll(queryParams);
      if (!res.success || res.data === null) {
        throw new Error(res.error?.message ?? "load");
      }
      if (!Array.isArray(res.data)) {
        throw new Error("Invalid payroll response");
      }
      return res;
    },
    staleTime: 30_000,
  });

  const rawRows = payrollQuery.data?.data;
  const rows: PayrollMonthlyRow[] = Array.isArray(rawRows) ? rawRows : [];
  const total = payrollQuery.data?.pagination?.total ?? 0;

  const summary = useMemo(() => {
    let totalGross = 0;
    let totalNet = 0;
    let totalSso = 0;
    let totalPit = 0;
    for (const r of rows) {
      totalGross += Number(r.gross_salary) || 0;
      totalNet += Number(r.net_salary) || 0;
      totalSso += Number(r.employee_sso) || 0;
      totalPit += Number(r.pit_amount) || 0;
    }
    return {
      employees: rows.length,
      totalGross,
      totalNet,
      totalSso,
      totalPit,
    };
  }, [rows]);

  const pendingCount = useMemo(() => rows.filter((r) => r.status === "PENDING").length, [rows]);
  const lockedCount = useMemo(() => rows.filter((r) => r.status === "LOCKED").length, [rows]);

  const form = useForm<FreeForm>({
    defaultValues: {
      free_allowance_1: 0,
      free_allowance_2: 0,
      free_allowance_3: 0,
      free_deduction_1: 0,
      free_deduction_2: 0,
    },
  });

  useEffect(() => {
    if (editRow) {
      form.reset({
        free_allowance_1: Number(editRow.free_allowance_1) || 0,
        free_allowance_2: Number(editRow.free_allowance_2) || 0,
        free_allowance_3: Number(editRow.free_allowance_3) || 0,
        free_deduction_1: Number(editRow.free_deduction_1) || 0,
        free_deduction_2: Number(editRow.free_deduction_2) || 0,
      });
    }
  }, [editRow, form]);

  const patchMut = useMutation({
    mutationFn: async (vals: FreeForm) => {
      if (!editRow) return;
      const res = await patchFreeFields(editRow.employee_code, editRow.payroll_month, vals);
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("master.saved_ok"));
      await qc.invalidateQueries({ queryKey: ["payroll", "monthly"] });
      setDrawerOpen(false);
      setEditRow(null);
    },
    onError: (err) => {
      const code = isAxiosError(err) ? (err.response?.data as ApiEnvelope<null>)?.error?.code : undefined;
      setDrawerErr(t(`payroll.errors.${code ?? "generic"}`, { defaultValue: t("payroll.errors.generic") }));
    },
  });

  const runMut = useMutation({
    onMutate: () => {
      setRunJobPhase("submitting");
    },
    onSettled: () => {
      setRunJobPhase("idle");
    },
    mutationFn: async () => {
      const res = await runPayroll(monthStr, runMinistry);
      if (!res.success || !res.data) throw new Error("run");
      if (res.data.status === "COMPLETED" && res.data.job_id === null) {
        return { processed: res.data.processed, month: res.data.month };
      }
      setRunJobPhase("queued");
      const final = await waitForPayrollRunJob(res.data.job_id, {
        onPoll: (p) => {
          if (p.status === "RUNNING") setRunJobPhase("running");
          else if (p.status === "QUEUED") setRunJobPhase("queued");
        },
      });
      if (final.status === "FAILURE") {
        const e = final.error;
        const code =
          e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : undefined;
        const msg =
          e && typeof e === "object" && "message" in e
            ? String((e as { message: unknown }).message)
            : t("payroll.run_failed");
        throw Object.assign(new Error(msg), { code });
      }
      const processed = final.result?.processed ?? 0;
      return { processed, month: final.result?.month ?? monthStr };
    },
    onSuccess: (data) => {
      message.success(t("payroll.run_success", { processed: data.processed }));
      setRunOpen(false);
      void qc.invalidateQueries({ queryKey: ["payroll", "monthly"] });
      void qc.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey[0];
          return typeof k === "string" && k.startsWith("dashboard");
        },
      });
    },
    onError: (err) => {
      if (err instanceof Error && err.message === "payroll_job_timeout") {
        message.error(t("payroll.run_timeout"));
        return;
      }
      if (err instanceof Error && !isAxiosError(err)) {
        const code = "code" in err ? (err as { code?: string }).code : undefined;
        message.error(
          code
            ? t(`payroll.errors.${code}`, { defaultValue: err.message })
            : err.message,
        );
        return;
      }
      const code = isAxiosError(err) ? (err.response?.data as ApiEnvelope<null>)?.error?.code : undefined;
      message.error(t(`payroll.errors.${code ?? "generic"}`, { defaultValue: t("payroll.errors.generic") }));
    },
  });

  const approveAllMut = useMutation({
    mutationFn: async () => {
      const res = await approvePayroll(monthStr, ministry || undefined);
      if (!res.success || !res.data) throw new Error("approve");
      return res.data;
    },
    onSuccess: (data) => {
      message.success(`${t("payroll.approve_all_btn")}: ${data.approved_rows}`);
      void qc.invalidateQueries({ queryKey: ["payroll", "monthly"] });
    },
    onError: (err) => {
      const code = isAxiosError(err) ? (err.response?.data as ApiEnvelope<null>)?.error?.code : undefined;
      message.error(t(`payroll.errors.${code ?? "generic"}`, { defaultValue: t("payroll.errors.generic") }));
    },
  });

  const approveRowMut = useMutation({
    mutationFn: async (code: string) => {
      const res = await approvePayroll(monthStr, undefined, code);
      if (!res.success) throw new Error("approve");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payroll", "monthly"] });
    },
    onError: (err) => {
      const code = isAxiosError(err) ? (err.response?.data as ApiEnvelope<null>)?.error?.code : undefined;
      message.error(t(`payroll.errors.${code ?? "generic"}`, { defaultValue: t("payroll.errors.generic") }));
    },
  });

  const lockMut = useMutation({
    mutationFn: async () => {
      const res = await lockPayroll(monthStr);
      if (!res.success) throw new Error("lock");
      return res.data;
    },
    onSuccess: () => {
      message.success(t("payroll.lock_btn"));
      void qc.invalidateQueries({ queryKey: ["payroll", "monthly"] });
    },
    onError: (err) => {
      const code = isAxiosError(err) ? (err.response?.data as ApiEnvelope<null>)?.error?.code : undefined;
      message.error(t(`payroll.errors.${code ?? "generic"}`, { defaultValue: t("payroll.errors.generic") }));
    },
  });

  const unlockMut = useMutation({
    mutationFn: async (reason: string) => {
      const res = await unlockPayroll(monthStr, reason);
      if (!res.success) throw new Error("unlock");
    },
    onSuccess: () => {
      message.success(t("payroll.unlock_btn"));
      setUnlockOpen(false);
      setUnlockReason("");
      void qc.invalidateQueries({ queryKey: ["payroll", "monthly"] });
    },
    onError: (err) => {
      const code = isAxiosError(err) ? (err.response?.data as ApiEnvelope<null>)?.error?.code : undefined;
      message.error(t(`payroll.errors.${code ?? "generic"}`, { defaultValue: t("payroll.errors.generic") }));
    },
  });

  const openFreeDrawer = useCallback(
    (row: PayrollMonthlyRow) => {
      setDrawerErr(null);
      setEditRow(row);
      setDrawerOpen(true);
    },
    [],
  );

  const statusBadge = (s: string | null | undefined) => {
    if (s == null || s === "") {
      return <Tag>—</Tag>;
    }
    const u = s.toUpperCase();
    if (u === "PENDING")
      return <Tag style={{ background: "#FFF8E1", color: "#F57F17", border: "none" }}>{t("payroll.status_PENDING")}</Tag>;
    if (u === "APPROVED")
      return <Tag style={{ background: "#E8F5E9", color: "#2E7D32", border: "none" }}>{t("payroll.status_APPROVED")}</Tag>;
    if (u === "LOCKED")
      return <Tag style={{ background: "#E3F2FD", color: "#1565C0", border: "none" }}>{t("payroll.status_LOCKED")}</Tag>;
    return <Tag>{s}</Tag>;
  };

  const showRowApprove = (row: PayrollMonthlyRow) => {
    if (row.status !== "PENDING") return false;
    return user?.role === ROLES.MANAGER || user?.role === ROLES.ADMIN;
  };

  const columns: ColumnsType<PayrollMonthlyRow> = useMemo(
    () => [
      { title: t("payroll.col_code"), dataIndex: "employee_code", key: "code", width: 100 },
      {
        title: t("payroll.col_name"),
        dataIndex: "full_name",
        key: "name",
        render: (name: string | null, row) => (
          <Link to={ROUTES.employeeEdit(row.employee_code)} style={{ color: NAVY }}>
            {name ?? "—"}
          </Link>
        ),
      },
      ...(showMinistryCol
        ? [
            {
              title: t("payroll.col_ministry"),
              dataIndex: "ministry_name",
              key: "ministry",
            } as const,
          ]
        : []),
      {
        title: t("payroll.col_grade_step"),
        key: "gs",
        width: 90,
        render: (_, row) => `G${row.grade}/S${row.step}`,
      },
      {
        title: t("payroll.col_basic"),
        dataIndex: "basic_salary",
        key: "basic",
        align: "right",
        render: (v: number) => Number(v).toLocaleString(),
      },
      {
        title: t("payroll.col_gross"),
        dataIndex: "gross_salary",
        key: "gross",
        align: "right",
        render: (v: number) => <span style={{ fontWeight: 500 }}>{Number(v).toLocaleString()}</span>,
      },
      {
        title: t("payroll.col_sso"),
        dataIndex: "employee_sso",
        key: "sso",
        align: "right",
        render: (v: number) => Number(v).toLocaleString(),
      },
      {
        title: t("payroll.col_pit"),
        dataIndex: "pit_amount",
        key: "pit",
        align: "right",
        render: (v: number) => Number(v).toLocaleString(),
      },
      {
        title: t("payroll.col_net"),
        dataIndex: "net_salary",
        key: "net",
        align: "right",
        render: (v: number) => (
          <span style={{ color: NAVY, fontWeight: 600, fontSize: 15 }}>{Number(v).toLocaleString()}</span>
        ),
      },
      {
        title: t("payroll.col_status"),
        dataIndex: "status",
        key: "status",
        render: (s: string | null | undefined) => statusBadge(s),
      },
      {
        title: t("payroll.col_free_fields"),
        key: "free",
        width: 90,
        render: (_, row) =>
          canEditFree && row.status !== "LOCKED" ? (
            <Button type="text" icon={<EditOutlined />} onClick={() => openFreeDrawer(row)} />
          ) : (
            "—"
          ),
      },
      {
        title: t("employee.col_actions"),
        key: "actions",
        width: 140,
        render: (_, row) =>
          showRowApprove(row) ? (
            <Button
              type="primary"
              size="small"
              ghost
              style={{ color: "#2E7D32", borderColor: "#2E7D32" }}
              onClick={() => approveRowMut.mutate(row.employee_code)}
              loading={approveRowMut.isPending}
            >
              {t("payroll.approve_btn")}
            </Button>
          ) : (
            "—"
          ),
      },
    ],
    [
      t,
      showMinistryCol,
      canEditFree,
      openFreeDrawer,
      approveRowMut,
      showRowApprove,
    ],
  );

  return (
    <div style={{ background: "#F7F8FA", minHeight: "100%", padding: "1rem" }}>
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
        <Typography.Title level={4} style={{ margin: 0, color: NAVY }}>
          {t("payroll.title")}
        </Typography.Title>
        {showRun && (
          <Button
            type="primary"
            style={{ background: NAVY }}
            onClick={() => {
              setRunJobPhase("idle");
              setRunOpen(true);
            }}
          >
            {t("payroll.run_btn")}
          </Button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <DatePicker
          picker="month"
          format="MMMM YYYY"
          value={month}
          onChange={(d) => {
            if (d) {
              setMonth(d.startOf("month"));
              setPage(1);
            }
          }}
          disabledDate={(d) => d.isAfter(dayjs(), "month")}
        />
        {showMinistryFilter && (
          <Select
            allowClear
            placeholder={t("employee.filter_ministry")}
            style={{ minWidth: 220 }}
            value={ministry || undefined}
            onChange={(v) => {
              setMinistry(v ?? "");
              setPage(1);
            }}
            options={ministryOptions.map((m) => ({ value: m, label: m }))}
          />
        )}
        <Select
          style={{ minWidth: 160 }}
          value={statusFilter || undefined}
          allowClear
          placeholder={t("employee.status_all")}
          onChange={(v) => {
            setStatusFilter(typeof v === "string" ? v : "");
            setPage(1);
          }}
          options={[
            { value: "PENDING", label: t("payroll.status_PENDING") },
            { value: "APPROVED", label: t("payroll.status_APPROVED") },
            { value: "LOCKED", label: t("payroll.status_LOCKED") },
          ]}
        />
      </div>

      {payrollQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={t("payroll.errors.generic")}
          description={
            payrollQuery.error instanceof Error ? payrollQuery.error.message : String(payrollQuery.error)
          }
          action={
            <Button size="small" onClick={() => void payrollQuery.refetch()}>
              {t("common.retry")}
            </Button>
          }
        />
      )}

      {showSummary && rows.length > 0 && !payrollQuery.isFetching && !payrollQuery.isError && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {[
            { label: t("payroll.stat_employees"), value: summary.employees, bg: "#F7F8FA", color: "#3D4F66" },
            { label: t("payroll.stat_gross"), value: summary.totalGross.toLocaleString(), bg: "#E8F5E9", color: "#2E7D32" },
            { label: t("payroll.stat_net"), value: summary.totalNet.toLocaleString(), bg: "#E3F2FD", color: "#1565C0" },
            { label: t("payroll.stat_pit"), value: summary.totalPit.toLocaleString(), bg: "#FFF8E1", color: "#F57F17" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                borderRadius: 8,
                padding: "12px 16px",
                background: s.bg,
                border: "0.5px solid #DDE1EA",
              }}
            >
              <div style={{ fontSize: 12, color: "#7A8599", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {payrollQuery.isFetching ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : payrollQuery.isError ? null : (
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 12,
            border: "0.5px solid #DDE1EA",
            padding: 16,
          }}
        >
          <Table<PayrollMonthlyRow>
            rowKey={(r) => `${r.employee_code}-${r.payroll_month}`}
            columns={columns}
            dataSource={rows}
            scroll={{ x: 1200 }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: false,
              onChange: (p) => setPage(p),
            }}
          />
        </div>
      )}

      {isFinancePlus && (
        <Space style={{ marginTop: 16 }} wrap>
          <Button
            type="primary"
            ghost
            style={{ color: "#2E7D32", borderColor: "#2E7D32" }}
            disabled={pendingCount === 0 || approveAllMut.isPending}
            loading={approveAllMut.isPending}
            onClick={() => approveAllMut.mutate()}
          >
            {t("payroll.approve_all_btn")}
          </Button>
          <Popconfirm
            title={t("payroll.lock_confirm", { month: monthStr })}
            okText={t("payroll.lock_btn")}
            onConfirm={() => lockMut.mutate()}
            disabled={pendingCount > 0 || lockMut.isPending}
          >
            <Button type="primary" ghost style={{ color: NAVY, borderColor: NAVY }} loading={lockMut.isPending}>
              {t("payroll.lock_btn")}
            </Button>
          </Popconfirm>
          {canUnlock && (
            <Button danger ghost disabled={lockedCount === 0} onClick={() => setUnlockOpen(true)}>
              {t("payroll.unlock_btn")}
            </Button>
          )}
        </Space>
      )}

      <Modal
        title={t("payroll.run_modal_title")}
        open={runOpen}
        onCancel={() => setRunOpen(false)}
        footer={null}
      >
        <Typography.Paragraph style={{ marginBottom: 8 }}>
          <strong>{monthStr}</strong>
        </Typography.Paragraph>
        {showMinistryFilter && (
          <Select
            allowClear
            placeholder={t("employee.filter_ministry")}
            style={{ width: "100%", marginBottom: 12 }}
            value={runMinistry}
            disabled={runMut.isPending}
            onChange={(v) => setRunMinistry(v)}
            options={ministryOptions.map((m) => ({ value: m, label: m }))}
          />
        )}
        <Typography.Paragraph style={{ fontSize: 13, color: "#7A8599", marginBottom: 16 }}>
          {t("payroll.run_warning")}
        </Typography.Paragraph>
        {runMut.isPending && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Spin size="small" />
            <Typography.Text type="secondary">
              {runJobPhase === "running"
                ? t("payroll.run_status_running")
                : runJobPhase === "queued"
                  ? t("payroll.run_status_queued")
                  : t("payroll.run_status_submitting")}
            </Typography.Text>
          </div>
        )}
        <Button
          type="primary"
          style={{ background: NAVY }}
          loading={runMut.isPending}
          disabled={runMut.isPending}
          onClick={() => runMut.mutate()}
        >
          {t("payroll.run_confirm_btn")}
        </Button>
      </Modal>

      <Modal
        title={t("payroll.unlock_modal_title")}
        open={unlockOpen}
        onCancel={() => setUnlockOpen(false)}
        onOk={() => {
          if (unlockReason.trim().length < 5) {
            message.error(t("change_password.error.too_short"));
            return;
          }
          unlockMut.mutate(unlockReason.trim());
        }}
        confirmLoading={unlockMut.isPending}
      >
        <Typography.Text>{t("payroll.unlock_reason_label")}</Typography.Text>
        <Input.TextArea
          style={{ marginTop: 8 }}
          rows={3}
          value={unlockReason}
          onChange={(e) => setUnlockReason(e.target.value)}
        />
      </Modal>

      <Drawer
        title={t("payroll.free_fields_drawer_title")}
        width={400}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditRow(null);
        }}
        footer={
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button onClick={() => setDrawerOpen(false)}>{t("master.cancel_btn")}</Button>
            <Button
              type="primary"
              style={{ background: NAVY }}
              loading={patchMut.isPending}
              onClick={form.handleSubmit((v) => patchMut.mutate(v))}
            >
              {t("master.save_btn")}
            </Button>
          </Space>
        }
      >
        {drawerErr && (
          <div
            style={{
              background: "#FFF0F0",
              borderLeft: "3px solid #E24B4A",
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 13,
              color: "#A32D2D",
              marginBottom: 12,
            }}
          >
            {drawerErr}
          </div>
        )}
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Typography.Text type="secondary">{t("payroll.free_allowance_1")}</Typography.Text>
            <Controller
              name="free_allowance_1"
              control={form.control}
              render={({ field }) => (
                <InputNumber min={0} style={{ width: "100%", marginTop: 4 }} {...field} />
              )}
            />
          </div>
          <div>
            <Typography.Text type="secondary">{t("payroll.free_allowance_2")}</Typography.Text>
            <Controller
              name="free_allowance_2"
              control={form.control}
              render={({ field }) => (
                <InputNumber min={0} style={{ width: "100%", marginTop: 4 }} {...field} />
              )}
            />
          </div>
          <div>
            <Typography.Text type="secondary">{t("payroll.free_allowance_3")}</Typography.Text>
            <Controller
              name="free_allowance_3"
              control={form.control}
              render={({ field }) => (
                <InputNumber min={0} style={{ width: "100%", marginTop: 4 }} {...field} />
              )}
            />
          </div>
          <div>
            <Typography.Text type="secondary">{t("payroll.free_deduction_1")}</Typography.Text>
            <Controller
              name="free_deduction_1"
              control={form.control}
              render={({ field }) => (
                <InputNumber min={0} style={{ width: "100%", marginTop: 4 }} {...field} />
              )}
            />
          </div>
          <div>
            <Typography.Text type="secondary">{t("payroll.free_deduction_2")}</Typography.Text>
            <Controller
              name="free_deduction_2"
              control={form.control}
              render={({ field }) => (
                <InputNumber min={0} style={{ width: "100%", marginTop: 4 }} {...field} />
              )}
            />
          </div>
        </Space>
      </Drawer>
    </div>
  );
}
