import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Drawer, Input, Segmented, Skeleton, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { isAxiosError } from "axios";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { createBank, fetchBanks, updateBank, type Bank, type BankUpdate } from "@/api/master";
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

type AddForm = Bank;
type EditForm = { swift_code: string | null; is_active: boolean };

export function BankMasterPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === ROLES.MANAGER || role === ROLES.ADMIN;
  const readOnlyRole = role === ROLES.EMPLOYEE || role === ROLES.DEPT_OFFICER;

  const [mode, setMode] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Bank | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  const q = useQuery({
    queryKey: ["master", "bank"],
    queryFn: async () => {
      const res = await fetchBanks();
      if (!res.success || !res.data) throw new Error("load");
      return res.data;
    },
    staleTime: 300_000,
  });

  const addForm = useForm<AddForm>({
    defaultValues: {
      bank_name: "",
      bank_code: "",
      swift_code: null,
      is_active: true,
    },
  });

  const editForm = useForm<EditForm>({
    defaultValues: { swift_code: null, is_active: true },
  });

  const openAdd = useCallback(() => {
    setBanner(null);
    setEditing(null);
    setMode("add");
    addForm.reset({
      bank_name: "",
      bank_code: "",
      swift_code: null,
      is_active: true,
    });
  }, [addForm]);

  const openEdit = useCallback(
    (row: Bank) => {
      setBanner(null);
      setEditing(row);
      setMode("edit");
      editForm.reset({
        swift_code: row.swift_code,
        is_active: row.is_active,
      });
    },
    [editForm],
  );

  const createMut = useMutation({
    mutationFn: async (vals: AddForm) => {
      const res = await createBank(vals);
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("master.added_ok"));
      await qc.invalidateQueries({ queryKey: ["master", "bank"] });
      setMode(null);
    },
    onError: (err) => {
      const { code, message: msg } = getErrorInfo(err);
      setBanner(t(`master.errors.${code ?? "generic"}`, { defaultValue: msg ?? t("master.errors.generic") }));
    },
  });

  const updateMut = useMutation({
    mutationFn: async (vals: EditForm) => {
      if (!editing) return;
      const body: BankUpdate = {
        swift_code: vals.swift_code,
        is_active: vals.is_active,
      };
      const res = await updateBank(editing.bank_name, editing.bank_code, body);
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("master.saved_ok"));
      await qc.invalidateQueries({ queryKey: ["master", "bank"] });
      setMode(null);
      setEditing(null);
    },
    onError: (err) => {
      const { code, message: msg } = getErrorInfo(err);
      setBanner(t(`master.errors.${code ?? "generic"}`, { defaultValue: msg ?? t("master.errors.generic") }));
    },
  });

  const closeDrawer = () => {
    setMode(null);
    setEditing(null);
    setBanner(null);
  };

  const displayRows = useMemo(
    () => (showActiveOnly ? (q.data ?? []).filter((r) => r.is_active) : q.data ?? []),
    [q.data, showActiveOnly],
  );

  const columns: ColumnsType<Bank> = useMemo(
    () => [
      { title: t("master.col.bank_name"), dataIndex: "bank_name", key: "bank_name" },
      { title: t("master.col.bank_code"), dataIndex: "bank_code", key: "bank_code" },
      { title: t("master.col.swift_code"), dataIndex: "swift_code", key: "swift_code", render: (v) => v ?? "—" },
      {
        title: t("master.col.is_active"),
        dataIndex: "is_active",
        key: "is_active",
        render: (active: boolean) =>
          active ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>,
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
    [canEdit, openEdit, t],
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
          {t("page.master.bank.title")}
        </Typography.Title>
        {canEdit && (
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
          {t("master.bank_edit_hint")} {t("master.read_only_hint")}
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

      {canEdit && !readOnlyRole && (
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
          {t("master.bank_manage_hint")}
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
          <Table<Bank>
            rowKey={(r) => `${r.bank_name}-${r.bank_code}`}
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
            ? `${t("master.add_btn")} — ${t("page.master.bank.title")}`
            : `${t("master.edit_btn")} — ${t("page.master.bank.title")}`
        }
        width={400}
        open={drawerOpen}
        onClose={closeDrawer}
        footer={
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button onClick={closeDrawer}>{t("master.cancel_btn")}</Button>
            <Button
              type="primary"
              style={{ background: "#1B3A6B" }}
              loading={createMut.isPending || updateMut.isPending}
              onClick={() => {
                if (mode === "add") void addForm.handleSubmit((v) => createMut.mutate(v))();
                if (mode === "edit") void editForm.handleSubmit((v) => updateMut.mutate(v))();
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
        {mode === "edit" && editing && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("master.col.bank_name")}
              </label>
              <Input value={editing.bank_name} disabled style={{ ...INPUT_STYLE, background: "#EEE" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("master.col.bank_code")}
              </label>
              <Input value={editing.bank_code} disabled style={{ ...INPUT_STYLE, background: "#EEE" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("master.col.swift_code")}
              </label>
              <Controller
                name="swift_code"
                control={editForm.control}
                render={({ field }) => (
                  <Input
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    style={{ ...INPUT_STYLE, background: "#FFFFFF" }}
                  />
                )}
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
                {t("master.col.bank_name")}
              </label>
              <Controller
                name="bank_name"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("master.col.bank_code")}
              </label>
              <Controller
                name="bank_code"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("master.col.swift_code")}
              </label>
              <Controller
                name="swift_code"
                control={addForm.control}
                render={({ field }) => (
                  <Input
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    style={{ ...INPUT_STYLE, background: "#FFFFFF" }}
                  />
                )}
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
