/** Screen: `AllowanceRatesPage` — page-level UI and mutations. */
import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, DatePicker, Drawer, Input, InputNumber, Pagination, Select, Skeleton, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { isAxiosError } from "axios";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  createAllowanceRate,
  fetchAllowanceRates,
  updateAllowanceRate,
  type AllowanceRate,
} from "@/api/master";
import { ROLES } from "@/config/constants";
import { useAuthStore } from "@/store/authStore";
import type { ApiEnvelope } from "@/types/auth";

const INPUT_STYLE: React.CSSProperties = {
  border: "0.5px solid #DDE1EA",
  borderRadius: 8,
  background: "#FAFBFC",
  fontSize: 14,
  width: "100%",
};

const BADGE_FLAT = { bg: "#E8F5E9", color: "#2E7D32" };
const BADGE_PCT = { bg: "#EEF2F9", color: "#3D5A8A" };

const WRAP: React.CSSProperties = { whiteSpace: "normal", wordBreak: "break-word" };

function getErrorInfo(err: unknown): { code?: string; message?: string } {
  if (
    isAxiosError(err) &&
    err.response?.data &&
    typeof err.response.data === "object" &&
    err.response.data !== null &&
    "error" in err.response.data
  ) {
    const e = (err.response.data as ApiEnvelope<null>).error;
    return { code: e?.code, message: e?.message ?? undefined };
  }
  return {};
}

type Form = {
  allowance_name: string;
  rate_type: string;
  rate_value: number;
  effective_date: Dayjs | null;
};

export function AllowanceRatesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === ROLES.MANAGER || role === ROLES.ADMIN;
  const readOnlyRole = role === ROLES.EMPLOYEE || role === ROLES.DEPT_OFFICER;

  const [mode, setMode] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<AllowanceRate | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const q = useQuery({
    queryKey: ["master", "allowance-rates", page, pageSize, debouncedSearch],
    queryFn: async () => {
      const res = await fetchAllowanceRates({
        page,
        size: pageSize,
        search: debouncedSearch || undefined,
      });
      if (!res.success || !res.data) throw new Error("load");
      return res.data;
    },
    staleTime: 60_000,
  });

  const form = useForm<Form>({
    defaultValues: {
      allowance_name: "",
      rate_type: "FLAT",
      rate_value: 0,
      effective_date: null,
    },
  });

  const openEdit = useCallback(
    (row: AllowanceRate) => {
      setBanner(null);
      setEditing(row);
      setMode("edit");
      const eff = row.effective_from ?? row.effective_date;
      form.reset({
        allowance_name: row.allowance_name,
        rate_type: row.rate_type === "PCT" ? "PCT" : "FLAT",
        rate_value: row.rate_value,
        effective_date: eff ? dayjs(eff) : null,
      });
    },
    [form],
  );

  const openAdd = useCallback(() => {
    setBanner(null);
    setEditing(null);
    setMode("add");
    form.reset({
      allowance_name: "",
      rate_type: "FLAT",
      rate_value: 0,
      effective_date: null,
    });
  }, [form]);

  const closeDrawer = () => {
    setMode(null);
    setEditing(null);
    setBanner(null);
  };

  const createMut = useMutation({
    mutationFn: async (vals: Form) => {
      const res = await createAllowanceRate({
        allowance_name: vals.allowance_name.trim(),
        rate_type: vals.rate_type,
        rate_value: vals.rate_value,
        effective_date: vals.effective_date ? vals.effective_date.format("YYYY-MM-DD") : null,
      });
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("master.added_ok"));
      await qc.invalidateQueries({ queryKey: ["master", "allowance-rates"] });
      closeDrawer();
    },
    onError: (err) => {
      const { code, message: msg } = getErrorInfo(err);
      setBanner(t(`master.errors.${code ?? "generic"}`, { defaultValue: msg ?? t("master.errors.generic") }));
    },
  });

  const updateMut = useMutation({
    mutationFn: async (vals: Form) => {
      if (!editing) return;
      const body: Partial<AllowanceRate> = {
        rate_type: vals.rate_type,
        rate_value: vals.rate_value,
        effective_date: vals.effective_date ? vals.effective_date.format("YYYY-MM-DD") : null,
      };
      const res = await updateAllowanceRate(editing.allowance_name, body);
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("master.saved_ok"));
      await qc.invalidateQueries({ queryKey: ["master", "allowance-rates"] });
      closeDrawer();
    },
    onError: (err) => {
      const { code, message: msg } = getErrorInfo(err);
      setBanner(t(`master.errors.${code ?? "generic"}`, { defaultValue: msg ?? t("master.errors.generic") }));
    },
  });

  const onSave = form.handleSubmit((vals) => {
    if (mode === "add") {
      if (!vals.allowance_name.trim()) {
        message.error(t("master.allowance_name_required"));
        return;
      }
      if (vals.rate_value < 0) {
        message.error(t("master.rate_value_positive"));
        return;
      }
      createMut.mutate(vals);
    } else if (mode === "edit") {
      updateMut.mutate(vals);
    }
  });

  const columns: ColumnsType<AllowanceRate> = useMemo(
    () => [
      {
        title: t("master.col.allowance_name"),
        dataIndex: "allowance_name",
        key: "allowance_name",
        width: 220,
        render: (v: string) => <span style={WRAP}>{v}</span>,
      },
      {
        title: t("master.col.rate_type"),
        dataIndex: "rate_type",
        key: "rate_type",
        width: 90,
        render: (rt: string) => {
          const isPct = rt === "PCT";
          const b = isPct ? BADGE_PCT : BADGE_FLAT;
          return (
            <Tag style={{ background: b.bg, color: b.color, border: "none" }}>
              {isPct ? "PCT" : "FLAT"}
            </Tag>
          );
        },
      },
      {
        title: t("master.col.rate_value"),
        dataIndex: "rate_value",
        key: "rate_value",
        width: 120,
        render: (v: number) => (v != null ? Number(v).toLocaleString() : "—"),
      },
      {
        title: t("allowanceRates.eligibility"),
        dataIndex: "eligibility",
        key: "eligibility",
        width: 280,
        render: (v: string | null) => <span style={WRAP}>{v ?? "—"}</span>,
      },
      {
        title: t("allowanceRates.description"),
        dataIndex: "description",
        key: "description",
        width: 380,
        render: (v: string | null) => <span style={WRAP}>{v ?? "—"}</span>,
      },
      {
        title: t("allowanceRates.effectiveFrom"),
        key: "effective_from",
        width: 120,
        render: (_v, row) => {
          const d = row.effective_from ?? row.effective_date;
          return d ? dayjs(d).format("DD/MM/YYYY") : "—";
        },
      },
      {
        title: t("allowanceRates.circularRef"),
        dataIndex: "circular_ref",
        key: "circular_ref",
        width: 200,
        render: (v: string | null) => <span style={WRAP}>{v ?? "—"}</span>,
      },
      {
        title: t("employee.col_actions"),
        key: "actions",
        width: 100,
        fixed: "right",
        render: (_, row) =>
          canEdit ? (
            <Button type="link" size="small" onClick={() => openEdit(row)}>
              {t("master.edit_btn")}
            </Button>
          ) : (
            "—"
          ),
      },
    ],
    [t, canEdit, openEdit],
  );

  const drawerOpen = mode !== null;
  const saving = createMut.isPending || updateMut.isPending;
  const total = q.data?.total ?? 0;

  return (
    <div style={{ background: "#F7F8FA", minHeight: "100%", padding: "1rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0, color: "#1B3A6B" }}>
          {t("page.master.allowanceRates.title")}
        </Typography.Title>
        {canEdit && (
          <Button type="primary" style={{ background: "#1B3A6B" }} icon={<PlusOutlined />} onClick={openAdd}>
            {t("master.add_btn")}
          </Button>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space align="center" wrap>
          <Input.Search
            allowClear
            placeholder={t("allowanceRates.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: 320 }}
          />
        </Space>
      </div>

      {readOnlyRole && (
        <div
          style={{
            background: "#EEF2F9",
            borderLeft: "3px solid #1B3A6B",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: 13,
            color: "#3D4A60",
            marginBottom: 12,
          }}
        >
          {t("master.read_only_hint")}
        </div>
      )}

      {q.isFetching ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <div
          style={{
            background: "#FFFFFF",
            border: "0.5px solid #DDE1EA",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <Table<AllowanceRate>
            rowKey="allowance_name"
            columns={columns}
            dataSource={q.data?.items ?? []}
            pagination={false}
            scroll={{ x: 1400 }}
            size="middle"
          />
          <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <Typography.Text type="secondary">{t("allowanceRates.totalRows", { count: total })}</Typography.Text>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              pageSizeOptions={["10", "20", "50"]}
              onChange={(p, ps) => {
                setPage(p);
                setPageSize(ps);
              }}
            />
          </div>
        </div>
      )}

      <Drawer
        title={
          mode === "add"
            ? `${t("master.add_btn")} — ${t("page.master.allowanceRates.title")}`
            : `${t("master.edit_btn")} — ${t("page.master.allowanceRates.title")}`
        }
        width={400}
        open={drawerOpen}
        onClose={closeDrawer}
        footer={
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button onClick={closeDrawer}>{t("master.cancel_btn")}</Button>
            <Button type="primary" style={{ background: "#1B3A6B" }} loading={saving} onClick={() => void onSave()}>
              {t("master.save_btn")}
            </Button>
          </Space>
        }
      >
        {banner && (
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
            {banner}
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
            {t("master.col.allowance_name")}
          </label>
          <Controller
            name="allowance_name"
            control={form.control}
            rules={mode === "add" ? { required: true } : undefined}
            render={({ field }) => (
              <Input
                {...field}
                disabled={mode === "edit"}
                style={{ ...INPUT_STYLE, background: mode === "edit" ? "#EEE" : "#FFFFFF" }}
              />
            )}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
            {t("master.col.rate_type")}
          </label>
          <Controller
            name="rate_type"
            control={form.control}
            render={({ field }) => (
              <Select
                {...field}
                style={{ ...INPUT_STYLE, minHeight: 40 }}
                options={[
                  { value: "FLAT", label: t("master.rate_type_flat") },
                  { value: "PCT", label: t("master.rate_type_pct") },
                ]}
              />
            )}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
            {t("master.col.rate_value")}
          </label>
          <Controller
            name="rate_value"
            control={form.control}
            rules={{ required: true, min: 0 }}
            render={({ field }) => (
              <InputNumber
                {...field}
                min={0}
                style={{ ...INPUT_STYLE, background: "#FFFFFF" }}
                className="w-full"
              />
            )}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
            {t("master.col.effective_date")}
          </label>
          <Controller
            name="effective_date"
            control={form.control}
            render={({ field }) => (
              <DatePicker
                {...field}
                format="DD/MM/YYYY"
                style={{ ...INPUT_STYLE, width: "100%", background: "#FFFFFF" }}
                value={field.value}
                onChange={(d) => field.onChange(d)}
              />
            )}
          />
        </div>
      </Drawer>
    </div>
  );
}
