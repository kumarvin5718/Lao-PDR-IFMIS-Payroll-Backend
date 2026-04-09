/** Screen: `OrgMasterPage` — page-level UI and mutations. */
import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Drawer, Input, Segmented, Select, Skeleton, Space, Switch, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { isAxiosError } from "axios";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { createOrg, fetchOrgs, updateOrg, type OrgCreate, type OrgRow, type OrgUpdate } from "@/api/master";
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

const PROFESSION_OPTIONS = [
  "Administration",
  "Finance",
  "Medical",
  "Teacher",
  "Technical",
  "Legal",
  "Diplomatic",
  "General",
].map((v) => ({ label: v, value: v }));

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
  department_name: string;
  division_name: string;
  profession_category: string;
  na_allowance_eligible: boolean;
  field_allowance_type: string | null;
  circular_ref: string;
  change_remarks: string;
  is_active: boolean;
};

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
  const [searchTerm, setSearchTerm] = useState("");

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
    defaultValues: {
      department_name: "",
      division_name: "",
      profession_category: "Administration",
      na_allowance_eligible: false,
      field_allowance_type: null,
      circular_ref: "",
      change_remarks: "",
      is_active: true,
    },
  });
  const addForm = useForm<AddForm>({
    defaultValues: {
      ministry_name: "",
      ministry_key: "",
      department_name: "",
      department_key: "",
      profession_category: "Administration",
      na_allowance_eligible: false,
      field_allowance_type: null,
      circular_ref: "",
      change_remarks: "",
    },
  });

  const profAdd = addForm.watch("profession_category");
  const profEdit = editForm.watch("profession_category");

  const openEdit = useCallback(
    (row: OrgRow) => {
      setBanner(null);
      setEditing(row);
      setMode("edit");
      editForm.reset({
        department_name: row.department_name,
        division_name: row.division_name ?? "",
        profession_category: row.profession_category,
        na_allowance_eligible: row.na_allowance_eligible,
        field_allowance_type: row.field_allowance_type,
        circular_ref: row.circular_ref ?? "",
        change_remarks: "",
        is_active: row.is_active,
      });
    },
    [editForm],
  );

  const openAdd = useCallback(() => {
    setBanner(null);
    setEditing(null);
    setMode("add");
    addForm.reset({
      ministry_name: "",
      ministry_key: "",
      department_name: "",
      department_key: "",
      profession_category: "Administration",
      na_allowance_eligible: false,
      field_allowance_type: null,
      circular_ref: "",
      change_remarks: "",
    });
  }, [addForm]);

  const updateMut = useMutation({
    mutationFn: async (vals: EditForm) => {
      if (!editing) return;
      const body: OrgUpdate = {
        department_name: vals.department_name,
        division_name: vals.division_name || null,
        profession_category: vals.profession_category,
        na_allowance_eligible: vals.na_allowance_eligible,
        field_allowance_type: vals.field_allowance_type,
        circular_ref: vals.circular_ref || null,
        change_remarks: vals.change_remarks || null,
        is_active: vals.is_active,
      };
      const res = await updateOrg(editing.ministry_key, editing.department_key, body);
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("orgMaster.scopeUpdated"));
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
      message.success(t("orgMaster.scopeSaved"));
      await qc.invalidateQueries({ queryKey: ["master", "org"] });
      setMode(null);
    },
    onError: (err) => {
      const { code, message: msg } = getErrorInfo(err);
      setBanner(t(`master.errors.${code ?? "generic"}`, { defaultValue: msg ?? t("master.errors.generic") }));
    },
  });

  const displayRows = useMemo(() => {
    const rows = q.data ?? [];
    const showAll = !showActiveOnly;
    const term = searchTerm.trim().toLowerCase();
    return rows
      .filter((r) => (showAll ? true : r.is_active))
      .filter((r) =>
        !term
          ? true
          : r.ministry_name.toLowerCase().includes(term) ||
            r.department_name.toLowerCase().includes(term) ||
            (r.department_key ?? "").toLowerCase().includes(term) ||
            (r.ministry_key ?? "").toLowerCase().includes(term),
      );
  }, [q.data, showActiveOnly, searchTerm]);

  const columns: ColumnsType<OrgRow> = useMemo(
    () => [
      { title: t("orgMaster.ministry"), dataIndex: "ministry_name", key: "ministry_name" },
      { title: t("orgMaster.department"), dataIndex: "department_name", key: "department_name" },
      {
        title: t("orgMaster.ministryKey"),
        dataIndex: "ministry_key",
        key: "ministry_key",
        width: 110,
      },
      {
        title: t("orgMaster.deptKey"),
        dataIndex: "department_key",
        key: "department_key",
        width: 120,
      },
      {
        title: t("orgMaster.professionCategory"),
        dataIndex: "profession_category",
        key: "profession_category",
        width: 150,
      },
      {
        title: t("orgMaster.naEligible"),
        dataIndex: "na_allowance_eligible",
        key: "na_allowance_eligible",
        width: 100,
        render: (val: boolean) =>
          val ? <Tag color="green">{t("common.yes")}</Tag> : <Tag>{t("common.no")}</Tag>,
      },
      {
        title: t("orgMaster.fieldAllowance"),
        dataIndex: "field_allowance_type",
        key: "field_allowance_type",
        width: 130,
        render: (val: string | null) => val ?? "—",
      },
      {
        title: t("master.col.is_active"),
        dataIndex: "is_active",
        key: "is_active",
        render: (active: boolean) =>
          active ? <Tag color="green">{t("master.tag_active")}</Tag> : <Tag color="red">{t("master.tag_inactive")}</Tag>,
      },
      {
        title: t("master.col_employees"),
        key: "emp_count",
        render: (_, row) => empCounts?.by_department[row.department_name] ?? 0,
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
          {t("orgMaster.title")}
        </Typography.Title>
        {canAdd && (
          <Button type="primary" style={{ background: "#1B3A6B" }} icon={<PlusOutlined />} onClick={openAdd}>
            {t("orgMaster.addScope")}
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
        <Space align="center" wrap>
          <Input.Search
            allowClear
            placeholder="Search ministry, department, dept key..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 320 }}
          />
          <span style={{ color: "#666" }}>{t("master.show_filter")}</span>
          <Segmented
            options={[
              { label: t("master.filter_all"), value: "all" },
              { label: t("master.filter_active_only"), value: "active" },
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
            rowKey={(r) => `${r.ministry_key}-${r.department_key}`}
            columns={columns}
            dataSource={displayRows}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50"],
              showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} records`,
            }}
            size="middle"
            scroll={{ x: 1200 }}
          />
        </div>
      )}

      <Drawer
        title={
          mode === "add"
            ? `${t("orgMaster.addScope")} — ${t("orgMaster.title")}`
            : `${t("master.edit_btn")} — ${t("orgMaster.title")}`
        }
        width={440}
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
                name="department_name"
                control={editForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("cascade.division")}
              </label>
              <Controller
                name="division_name"
                control={editForm.control}
                render={({ field }) => (
                  <Input
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    style={{ ...INPUT_STYLE, background: "#FFFFFF" }}
                  />
                )}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("orgMaster.professionCategory")}
              </label>
              <Controller
                name="profession_category"
                control={editForm.control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select {...field} style={{ width: "100%" }} options={PROFESSION_OPTIONS} />
                )}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("orgMaster.naEligible")}
              </label>
              <Controller
                name="na_allowance_eligible"
                control={editForm.control}
                render={({ field }) => <Switch checked={field.value} onChange={field.onChange} />}
              />
            </div>
            {(profEdit === "Teacher" || profEdit === "Medical") && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                  {t("orgMaster.fieldAllowance")}
                </label>
                <Controller
                  name="field_allowance_type"
                  control={editForm.control}
                  render={({ field }) => (
                    <Select
                      allowClear
                      style={{ width: "100%" }}
                      value={field.value ?? undefined}
                      onChange={(v) => field.onChange(v ?? null)}
                      options={[
                        { label: "Teaching", value: "Teaching" },
                        { label: "Medical", value: "Medical" },
                      ]}
                    />
                  )}
                />
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("orgMaster.circularRef")}
              </label>
              <Controller
                name="circular_ref"
                control={editForm.control}
                render={({ field }) => (
                  <Input
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    style={{ ...INPUT_STYLE, background: "#FFFFFF" }}
                  />
                )}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("audit.remarks")}
              </label>
              <Controller
                name="change_remarks"
                control={editForm.control}
                render={({ field }) => (
                  <Input
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
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
                {t("master.col.dept_display_name")}
              </label>
              <Controller
                name="department_name"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("orgMaster.ministryKey")}
              </label>
              <Controller
                name="ministry_key"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("orgMaster.deptKey")}
              </label>
              <Controller
                name="department_key"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("orgMaster.professionCategory")}
              </label>
              <Controller
                name="profession_category"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select {...field} style={{ width: "100%" }} options={PROFESSION_OPTIONS} />
                )}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("orgMaster.naEligible")}
              </label>
              <Controller
                name="na_allowance_eligible"
                control={addForm.control}
                render={({ field }) => <Switch checked={field.value} onChange={field.onChange} />}
              />
            </div>
            {(profAdd === "Teacher" || profAdd === "Medical") && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                  {t("orgMaster.fieldAllowance")}
                </label>
                <Controller
                  name="field_allowance_type"
                  control={addForm.control}
                  render={({ field }) => (
                    <Select
                      allowClear
                      style={{ width: "100%" }}
                      value={field.value ?? undefined}
                      onChange={(v) => field.onChange(v ?? null)}
                      options={[
                        { label: "Teaching", value: "Teaching" },
                        { label: "Medical", value: "Medical" },
                      ]}
                    />
                  )}
                />
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("orgMaster.circularRef")}
              </label>
              <Controller
                name="circular_ref"
                control={addForm.control}
                render={({ field }) => (
                  <Input
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    style={{ ...INPUT_STYLE, background: "#FFFFFF" }}
                  />
                )}
              />
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}
