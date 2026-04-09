/** Screen: `GradeDerivationPage` — page-level UI and mutations. */
import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Drawer, Input, InputNumber, Skeleton, Space, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { createGradeDerivation, fetchGradeDerivations, updateGradeDerivation, type GradeDerivation } from "@/api/master";
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

type Form = {
  education_level: string;
  min_exp_years: number;
  exp_max_years: number | null;
  derived_grade: number;
  derived_step: number;
};

export function GradeDerivationPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === ROLES.MANAGER || role === ROLES.ADMIN;
  const showReadOnlyHint = !canEdit;

  const [mode, setMode] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<GradeDerivation | null>(null);
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
    queryKey: ["master", "grade-derivation", page, pageSize, debouncedSearch],
    queryFn: async () => {
      const res = await fetchGradeDerivations({
        page,
        size: pageSize,
        search: debouncedSearch || undefined,
      });
      if (!res.success || !res.data) throw new Error("load");
      return res.data;
    },
    staleTime: 300_000,
  });

  const form = useForm<Form>({
    defaultValues: {
      education_level: "",
      min_exp_years: 0,
      exp_max_years: null,
      derived_grade: 1,
      derived_step: 1,
    },
  });

  const openEdit = useCallback(
    (row: GradeDerivation) => {
      setBanner(null);
      setEditing(row);
      setMode("edit");
      form.reset({
        education_level: row.education_level,
        min_exp_years: row.min_exp_years,
        exp_max_years: row.exp_max_years ?? null,
        derived_grade: row.derived_grade,
        derived_step: row.derived_step,
      });
    },
    [form],
  );

  const openAdd = useCallback(() => {
    setBanner(null);
    setEditing(null);
    setMode("add");
    form.reset({
      education_level: "",
      min_exp_years: 0,
      exp_max_years: null,
      derived_grade: 1,
      derived_step: 1,
    });
  }, [form]);

  const closeDrawer = () => {
    setMode(null);
    setEditing(null);
    setBanner(null);
  };

  const createMut = useMutation({
    mutationFn: async (vals: Form) => {
      const res = await createGradeDerivation({
        education_level: vals.education_level.trim(),
        min_exp_years: vals.min_exp_years,
        exp_max_years: vals.exp_max_years,
        derived_grade: vals.derived_grade,
        derived_step: vals.derived_step,
      });
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("master.added_ok"));
      await qc.invalidateQueries({ queryKey: ["master", "grade-derivation"] });
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
      const res = await updateGradeDerivation(editing.education_level, editing.min_exp_years, {
        derived_grade: vals.derived_grade,
        derived_step: vals.derived_step,
      });
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("master.saved_ok"));
      await qc.invalidateQueries({ queryKey: ["master", "grade-derivation"] });
      closeDrawer();
    },
    onError: (err) => {
      const { code, message: msg } = getErrorInfo(err);
      setBanner(t(`master.errors.${code ?? "generic"}`, { defaultValue: msg ?? t("master.errors.generic") }));
    },
  });

  const onSave = form.handleSubmit((vals) => {
    if (mode === "add") {
      if (!vals.education_level.trim()) {
        message.error(t("master.education_level_required"));
        return;
      }
      createMut.mutate(vals);
    } else if (mode === "edit") {
      updateMut.mutate(vals);
    }
  });

  const columns: ColumnsType<GradeDerivation> = useMemo(
    () => [
      { title: t("master.col.education_level"), dataIndex: "education_level", key: "education_level" },
      { title: t("master.col.min_exp_years"), dataIndex: "min_exp_years", key: "min_exp_years" },
      {
        title: t("gradeDerivation.maxExpYears"),
        dataIndex: "exp_max_years",
        key: "exp_max_years",
        width: 120,
        render: (v: number | null) => (v === null || v === undefined ? "—" : v),
      },
      { title: t("master.col.derived_grade"), dataIndex: "derived_grade", key: "derived_grade" },
      { title: t("master.col.derived_step"), dataIndex: "derived_step", key: "derived_step" },
      {
        title: t("gradeDerivation.ruleDescription"),
        dataIndex: "rule_description",
        key: "rule_description",
        render: (v: string | null) => v || "—",
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
    ],
    [t, canEdit, openEdit],
  );

  const drawerOpen = mode !== null;
  const saving = createMut.isPending || updateMut.isPending;

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
          {t("page.master.gradeDerivation.title")}
        </Typography.Title>
        {canEdit && (
          <Button type="primary" style={{ background: "#1B3A6B" }} icon={<PlusOutlined />} onClick={openAdd}>
            {t("master.add_btn")}
          </Button>
        )}
      </div>

      {showReadOnlyHint && (
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

      <div style={{ marginBottom: 16 }}>
        <Space align="center" wrap>
          <Input.Search
            allowClear
            placeholder={t("gradeDerivation.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: 320 }}
          />
        </Space>
      </div>

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
          <Table<GradeDerivation>
            rowKey={(r) => `${r.education_level}-${r.min_exp_years}`}
            columns={columns}
            dataSource={q.data?.items ?? []}
            pagination={{
              current: page,
              pageSize: pageSize,
              total: q.data?.total ?? 0,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50"],
              showTotal: (total) => t("gradeDerivation.totalRows", { count: total }),
              onChange: (newPage, newSize) => {
                setPage(newPage);
                setPageSize(newSize);
              },
            }}
            size="middle"
          />
        </div>
      )}

      <Drawer
        title={
          mode === "add"
            ? `${t("master.add_btn")} — ${t("page.master.gradeDerivation.title")}`
            : `${t("master.edit_btn")} — ${t("page.master.gradeDerivation.title")}`
        }
        width={440}
        open={drawerOpen}
        onClose={closeDrawer}
        styles={{ body: { paddingTop: 16 } }}
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
            {t("master.col.education_level")}
          </label>
          <Controller
            name="education_level"
            control={form.control}
            rules={{ required: mode === "add" }}
            render={({ field }) => (
              <Input
                {...field}
                disabled={mode === "edit"}
                style={{ ...INPUT_STYLE, background: mode === "edit" ? "#EEE" : "#FFFFFF", padding: "8px 12px" }}
              />
            )}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
            {t("master.col.min_exp_years")}
          </label>
          <Controller
            name="min_exp_years"
            control={form.control}
            rules={{ required: true }}
            render={({ field }) => (
              <InputNumber
                {...field}
                min={0}
                max={99}
                disabled={mode === "edit"}
                style={{ ...INPUT_STYLE, background: mode === "edit" ? "#EEE" : "#FFFFFF", width: "100%" }}
              />
            )}
          />
        </div>
        {mode === "add" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
              {t("master.col.exp_max_years")}
            </label>
            <Controller
              name="exp_max_years"
              control={form.control}
              render={({ field }) => (
                <InputNumber
                  min={0}
                  max={99}
                  placeholder={t("master.exp_max_placeholder")}
                  style={{ ...INPUT_STYLE, width: "100%" }}
                  value={field.value ?? undefined}
                  onChange={(v) => field.onChange(v ?? null)}
                />
              )}
            />
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
            {t("master.col.derived_grade")}
          </label>
          <Controller
            name="derived_grade"
            control={form.control}
            rules={{ required: true, min: 1, max: 10 }}
            render={({ field }) => (
              <InputNumber {...field} min={1} max={10} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />
            )}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
            {t("master.col.derived_step")}
          </label>
          <Controller
            name="derived_step"
            control={form.control}
            rules={{ required: true, min: 1, max: 15 }}
            render={({ field }) => (
              <InputNumber {...field} min={1} max={15} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />
            )}
          />
        </div>
      </Drawer>
    </div>
  );
}
