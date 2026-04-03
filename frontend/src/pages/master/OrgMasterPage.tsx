import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Drawer, Input, Segmented, Skeleton, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { isAxiosError } from "axios";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { createOrg, fetchOrgs, updateOrg, type OrgCreate, type OrgRow } from "@/api/master";
import { useEmployeeCounts } from "@/api/masterScope";
import { ROLES } from "@/config/constants";
import { useAuthStore } from "@/store/authStore";
import type { ApiEnvelope } from "@/types/auth";

const INPUT_STYLE: React.CSSProperties = {
  border: "0.5px solid #DDE1EA",
  borderRadius: 8,
  background: "#FAFBFC",
  fontSize: 14,
  width: "100%",
  padding: "8px 12px",
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

type EditForm = { dept_display_name: string; is_active: boolean };
type AddForm = OrgCreate;

export function OrgMasterPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === ROLES.MANAGER || role === ROLES.ADMIN;
  const canAdd = canEdit;
  const readOnlyRole = role === ROLES.EMPLOYEE || role === ROLES.DEPT_OFFICER;

  const [mode, setMode] = useState<"edit" | "add" | null>(null);
  const [editing, setEditing] = useState<OrgRow | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  const { data: empCounts } = useEmployeeCounts();

  const q = useQuery({
    queryKey: ["master", "org"],
    queryFn: async () => {
      const res = await fetchOrgs();
      if (!res.success || !res.data) throw new Error("load");
      return res.data;
    },
    staleTime: 300_000,
  });

  const editForm = useForm<EditForm>({
    defaultValues: { dept_display_name: "", is_active: true },
  });
  const addForm = useForm<AddForm>({
    defaultValues: {
      ministry_name: "",
      dept_key: "",
      dept_display_name: "",
      is_active: true,
    },
  });

  const openEdit = useCallback(
    (row: OrgRow) => {
      setBanner(null);
      setEditing(row);
      setMode("edit");
      editForm.reset({ dept_display_name: row.dept_display_name, is_active: row.is_active });
    },
    [editForm],
  );

  const openAdd = useCallback(() => {
    setBanner(null);
    setEditing(null);
    setMode("add");
    addForm.reset({
      ministry_name: "",
      dept_key: "",
      dept_display_name: "",
      is_active: true,
    });
  }, [addForm]);

  const updateMut = useMutation({
    mutationFn: async (vals: EditForm) => {
      if (!editing) return;
      const res = await updateOrg(editing.ministry_name, editing.dept_key, {
        dept_display_name: vals.dept_display_name,
        is_active: vals.is_active,
      });
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("master.saved_ok"));
      await qc.invalidateQueries({ queryKey: ["master", "org"] });
      setMode(null);
      setEditing(null);
    },
    onError: (err) => {
      const { code, message: msg } = getErrorInfo(err);
      setBanner(t(`master.errors.${code ?? "generic"}`, { defaultValue: msg ?? t("master.errors.generic") }));
    },
  });

  const createMut = useMutation({
    mutationFn: async (vals: AddForm) => {
      const res = await createOrg(vals);
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("master.added_ok"));
      await qc.invalidateQueries({ queryKey: ["master", "org"] });
      setMode(null);
    },
    onError: (err) => {
      const { code, message: msg } = getErrorInfo(err);
      setBanner(t(`master.errors.${code ?? "generic"}`, { defaultValue: msg ?? t("master.errors.generic") }));
    },
  });

  const displayRows = useMemo(
    () => (showActiveOnly ? (q.data ?? []).filter((r) => r.is_active) : q.data ?? []),
    [q.data, showActiveOnly],
  );

  const columns: ColumnsType<OrgRow> = useMemo(
    () => [
      { title: t("master.col.ministry_name"), dataIndex: "ministry_name", key: "ministry_name" },
      { title: t("master.col.dept_key"), dataIndex: "dept_key", key: "dept_key" },
      { title: t("master.col.dept_display_name"), dataIndex: "dept_display_name", key: "dept_display_name" },
      {
        title: t("master.col.is_active"),
        dataIndex: "is_active",
        key: "is_active",
        render: (active: boolean) =>
          active ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>,
      },
      {
        title: "Employees",
        key: "emp_count",
        render: (_, row) => empCounts?.by_department[row.dept_display_name] ?? 0,
      },
      {
        title: t("employee.col_actions"),
        key: "actions",
        width: 120,
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
    [canEdit, empCounts?.by_department, openEdit, t],
  );

  const drawerOpen = mode !== null;

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
          {t("page.master.org.title")}
        </Typography.Title>
        {canAdd && (
          <Button type="primary" style={{ background: "#1B3A6B" }} icon={<PlusOutlined />} onClick={openAdd}>
            {t("master.add_btn")}
          </Button>
        )}
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

      <div style={{ marginBottom: 16 }}>
        <Space align="center">
          <span style={{ color: "#666" }}>Show:</span>
          <Segmented
            options={[
              { label: "All", value: "all" },
              { label: "Active only", value: "active" },
            ]}
            value={showActiveOnly ? "active" : "all"}
            onChange={(v) => setShowActiveOnly(v === "active")}
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
          <Table<OrgRow>
            rowKey={(r) => `${r.ministry_name}-${r.dept_key}`}
            columns={columns}
            dataSource={displayRows}
            pagination={false}
            size="middle"
          />
        </div>
      )}

      <Drawer
        title={
          mode === "add"
            ? `${t("master.add_btn")} — ${t("page.master.org.title")}`
            : `${t("master.edit_btn")} — ${t("page.master.org.title")}`
        }
        width={400}
        open={drawerOpen}
        onClose={() => {
          setMode(null);
          setEditing(null);
        }}
        footer={
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button
              onClick={() => {
                setMode(null);
                setEditing(null);
              }}
            >
              {t("master.cancel_btn")}
            </Button>
            <Button
              type="primary"
              style={{ background: "#1B3A6B" }}
              loading={updateMut.isPending || createMut.isPending}
              onClick={() => {
                if (mode === "edit") {
                  void editForm.handleSubmit((v) => updateMut.mutate(v))();
                } else if (mode === "add") {
                  void addForm.handleSubmit((v) => createMut.mutate(v))();
                }
              }}
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
        {mode === "edit" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("master.col.dept_display_name")}
              </label>
              <Controller
                name="dept_display_name"
                control={editForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <Controller
              name="is_active"
              control={editForm.control}
              render={({ field }) => (
                <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)}>
                  {t("master.col.is_active")}
                </Checkbox>
              )}
            />
          </>
        )}
        {mode === "add" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("master.col.ministry_name")}
              </label>
              <Controller
                name="ministry_name"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("master.col.dept_key")}
              </label>
              <Controller
                name="dept_key"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("master.col.dept_display_name")}
              </label>
              <Controller
                name="dept_display_name"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <Controller
              name="is_active"
              control={addForm.control}
              render={({ field }) => (
                <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)}>
                  {t("master.col.is_active")}
                </Checkbox>
              )}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
