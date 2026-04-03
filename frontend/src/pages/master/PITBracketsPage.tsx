import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Drawer, InputNumber, Skeleton, Space, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { isAxiosError } from "axios";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { fetchPITBrackets, updatePITBracket, type PITBracket } from "@/api/master";
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

type EditForm = {
  lower_bound: number;
  upper_bound: number | null;
  rate_pct: number;
  deduction_amount: number;
};

export function PITBracketsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === ROLES.MANAGER || role === ROLES.ADMIN;
  const readOnlyRole = role === ROLES.EMPLOYEE || role === ROLES.DEPT_OFFICER;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PITBracket | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["master", "pit-brackets"],
    queryFn: async () => {
      const res = await fetchPITBrackets();
      if (!res.success || !res.data) throw new Error("load");
      return res.data;
    },
    staleTime: 300_000,
  });

  const form = useForm<EditForm>({
    defaultValues: {
      lower_bound: 0,
      upper_bound: null,
      rate_pct: 0,
      deduction_amount: 0,
    },
  });

  const openEdit = useCallback(
    (row: PITBracket) => {
      setBanner(null);
      setEditing(row);
      form.reset({
        lower_bound: row.lower_bound,
        upper_bound: row.upper_bound,
        rate_pct: row.rate_pct,
        deduction_amount: row.deduction_amount,
      });
      setDrawerOpen(true);
    },
    [form],
  );

  const mutation = useMutation({
    mutationFn: async (vals: EditForm) => {
      if (!editing) return;
      const body: Partial<PITBracket> = {
        lower_bound: vals.lower_bound,
        upper_bound: vals.upper_bound,
        rate_pct: vals.rate_pct,
        deduction_amount: vals.deduction_amount,
      };
      const res = await updatePITBracket(editing.bracket_no, body);
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("master.saved_ok"));
      await qc.invalidateQueries({ queryKey: ["master", "pit-brackets"] });
      setDrawerOpen(false);
      setEditing(null);
    },
    onError: (err) => {
      const { code, message: msg } = getErrorInfo(err);
      setBanner(t(`master.errors.${code ?? "generic"}`, { defaultValue: msg ?? t("master.errors.generic") }));
    },
  });

  const columns: ColumnsType<PITBracket> = [
    { title: t("master.col.bracket_no"), dataIndex: "bracket_no", key: "bracket_no" },
    {
      title: t("master.col.lower_bound"),
      dataIndex: "lower_bound",
      key: "lower_bound",
      render: (v: number) => (v != null ? Number(v).toLocaleString() : "—"),
    },
    {
      title: t("master.col.upper_bound"),
      dataIndex: "upper_bound",
      key: "upper_bound",
      render: (v: number | null) => (v == null ? t("master.pit_no_limit") : Number(v).toLocaleString()),
    },
    {
      title: t("master.col.rate_pct"),
      dataIndex: "rate_pct",
      key: "rate_pct",
      render: (v: number) => (v != null ? `${v}` : "—"),
    },
    {
      title: t("master.col.deduction_amount"),
      dataIndex: "deduction_amount",
      key: "deduction_amount",
      render: (v: number) => (v != null ? Number(v).toLocaleString() : "—"),
    },
    {
      title: t("employee.col_actions"),
      key: "actions",
      width: 100,
      render: (_, row) =>
        canEdit ? (
          <Button type="link" size="small" onClick={() => openEdit(row)}>
            {t("master.edit_btn")}
          </Button>
        ) : (
          "—"
        ),
    },
  ];

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
          {t("page.master.pitBrackets.title")}
        </Typography.Title>
      </div>

      <div
        style={{
          background: "#EEF2F9",
          borderLeft: "3px solid #1B3A6B",
          borderRadius: 6,
          padding: "10px 14px",
          fontSize: 13,
          color: "#3D4A60",
          marginBottom: 16,
        }}
      >
        {t("master.pit_warning")}
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
          <Table<PITBracket>
            rowKey="bracket_no"
            columns={columns}
            dataSource={q.data ?? []}
            pagination={false}
            size="middle"
          />
        </div>
      )}

      <Drawer
        title={t("master.edit_btn") + " — " + t("page.master.pitBrackets.title")}
        width={400}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        footer={
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button
              onClick={() => {
                setDrawerOpen(false);
                setEditing(null);
              }}
            >
              {t("master.cancel_btn")}
            </Button>
            <Button
              type="primary"
              style={{ background: "#1B3A6B" }}
              loading={mutation.isPending}
              onClick={form.handleSubmit((vals) => mutation.mutate(vals))}
            >
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
            {t("master.col.lower_bound")}
          </label>
          <Controller
            name="lower_bound"
            control={form.control}
            rules={{ required: true, min: 0 }}
            render={({ field }) => (
              <InputNumber
                {...field}
                min={0}
                style={{ ...INPUT_STYLE, background: "#FFFFFF", width: "100%" }}
                formatter={(v) => (v != null ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "")}
                parser={(v) => (v ? Number(v.replace(/,/g, "")) : 0)}
              />
            )}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
            {t("master.col.upper_bound")} ({t("master.pit_optional_upper")})
          </label>
          <Controller
            name="upper_bound"
            control={form.control}
            render={({ field }) => (
              <InputNumber
                min={0}
                style={{ ...INPUT_STYLE, background: "#FFFFFF", width: "100%" }}
                value={field.value ?? undefined}
                onChange={(v) => field.onChange(v === null || v === undefined ? null : v)}
                formatter={(v) => (v != null ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "")}
                parser={(v) => (v ? Number(v.replace(/,/g, "")) : 0)}
              />
            )}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
            {t("master.col.rate_pct")}
          </label>
          <Controller
            name="rate_pct"
            control={form.control}
            rules={{ required: true, min: 0, max: 100 }}
            render={({ field }) => (
              <InputNumber
                {...field}
                min={0}
                max={100}
                step={0.5}
                style={{ ...INPUT_STYLE, background: "#FFFFFF", width: "100%" }}
              />
            )}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
            {t("master.col.deduction_amount")}
          </label>
          <Controller
            name="deduction_amount"
            control={form.control}
            rules={{ required: true, min: 0 }}
            render={({ field }) => (
              <InputNumber
                {...field}
                min={0}
                style={{ ...INPUT_STYLE, background: "#FFFFFF", width: "100%" }}
                formatter={(v) => (v != null ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "")}
                parser={(v) => (v ? Number(v.replace(/,/g, "")) : 0)}
              />
            )}
          />
        </div>
      </Drawer>
    </div>
  );
}
