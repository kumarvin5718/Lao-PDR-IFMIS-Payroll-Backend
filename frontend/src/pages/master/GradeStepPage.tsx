import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Drawer, InputNumber, Skeleton, Space, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { isAxiosError } from "axios";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { fetchGradeSteps, updateGradeStep, type GradeStep } from "@/api/master";
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

type EditForm = { basic_salary: number };

export function GradeStepPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === ROLES.MANAGER || role === ROLES.ADMIN;
  const readOnlyRole = role === ROLES.EMPLOYEE || role === ROLES.DEPT_OFFICER;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<GradeStep | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["master", "grade-step"],
    queryFn: async () => {
      const res = await fetchGradeSteps();
      if (!res.success || !res.data) throw new Error("load");
      return res.data;
    },
    staleTime: 300_000,
  });

  const form = useForm<EditForm>({ defaultValues: { basic_salary: 0 } });

  const openEdit = useCallback(
    (row: GradeStep) => {
      setBanner(null);
      setEditing(row);
      form.reset({ basic_salary: row.basic_salary });
      setDrawerOpen(true);
    },
    [form],
  );

  const mutation = useMutation({
    mutationFn: async (vals: EditForm) => {
      if (!editing) return;
      const res = await updateGradeStep(editing.grade, editing.step, { basic_salary: vals.basic_salary });
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("master.saved_ok"));
      await qc.invalidateQueries({ queryKey: ["master", "grade-step"] });
      setDrawerOpen(false);
      setEditing(null);
    },
    onError: (err) => {
      const { code, message: msg } = getErrorInfo(err);
      setBanner(t(`master.errors.${code ?? "generic"}`, { defaultValue: msg ?? t("master.errors.generic") }));
    },
  });

  const columns: ColumnsType<GradeStep> = [
    { title: t("master.col.grade"), dataIndex: "grade", key: "grade" },
    { title: t("master.col.step"), dataIndex: "step", key: "step" },
    {
      title: t("master.col.basic_salary"),
      dataIndex: "basic_salary",
      key: "basic_salary",
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
          {t("page.master.gradeStep.title")}
        </Typography.Title>
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
          <Table<GradeStep>
            rowKey={(r) => `${r.grade}-${r.step}`}
            columns={columns}
            dataSource={q.data ?? []}
            pagination={false}
            size="middle"
          />
        </div>
      )}

      <Drawer
        title={t("master.edit_btn") + " — " + t("page.master.gradeStep.title")}
        width={400}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        styles={{ body: { paddingTop: 16 } }}
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
        <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
          {t("master.col.basic_salary")}
        </label>
        <Controller
          name="basic_salary"
          control={form.control}
          rules={{ required: true, min: 0.0001 }}
          render={({ field, fieldState }) => (
            <>
              <InputNumber
                {...field}
                min={0}
                style={{ ...INPUT_STYLE, background: "#FFFFFF" }}
                formatter={(v) => (v != null ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "")}
                parser={(v) => (v ? Number(v.replace(/,/g, "")) : 0)}
                onChange={(v) => field.onChange(v ?? 0)}
              />
              {fieldState.error && (
                <div style={{ fontSize: 12, color: "#E24B4A", marginTop: 4 }}>Required (&gt; 0)</div>
              )}
            </>
          )}
        />
      </Drawer>
    </div>
  );
}
