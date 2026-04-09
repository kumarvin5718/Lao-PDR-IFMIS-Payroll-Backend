/** Screen: `BankMasterPage` — page-level UI and mutations. */
import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Drawer, Input, Segmented, Skeleton, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { isAxiosError } from "axios";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
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

const WRAP: React.CSSProperties = { whiteSpace: "normal", wordBreak: "break-word" };

function fmtDate(s: string | null | undefined): string {
  if (s == null || s === "") return "—";
  const d = dayjs(s);
  return d.isValid() ? d.format("DD/MM/YYYY") : "—";
}

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

type AddForm = {
  bank_name: string;
  bank_code: string;
  swift_code: string | null;
  is_active: boolean;
};

type EditForm = {
  swift_code: string | null;
  is_active: boolean;
  category: string | null;
  bank_abbrev: string | null;
  city: string | null;
  branch_address: string | null;
  bank_hq_address: string | null;
  telephone: string | null;
  ownership: string | null;
  established: string | null;
  website: string | null;
  circular_ref: string | null;
  change_remarks: string | null;
};

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
  }, [debouncedSearch, showActiveOnly]);

  const q = useQuery({
    queryKey: ["master", "bank", page, pageSize, debouncedSearch, showActiveOnly],
    queryFn: async () => {
      const res = await fetchBanks({
        page,
        size: pageSize,
        search: debouncedSearch || undefined,
        active_only: showActiveOnly,
      });
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
    defaultValues: {
      swift_code: null,
      is_active: true,
      category: null,
      bank_abbrev: null,
      city: null,
      branch_address: null,
      bank_hq_address: null,
      telephone: null,
      ownership: null,
      established: null,
      website: null,
      circular_ref: null,
      change_remarks: null,
    },
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
        category: row.category,
        bank_abbrev: row.bank_abbrev,
        city: row.city,
        branch_address: row.branch_address,
        bank_hq_address: row.bank_hq_address,
        telephone: row.telephone,
        ownership: row.ownership,
        established: row.established,
        website: row.website,
        circular_ref: row.circular_ref,
        change_remarks: row.change_remarks,
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
        category: vals.category,
        bank_abbrev: vals.bank_abbrev,
        city: vals.city,
        branch_address: vals.branch_address,
        bank_hq_address: vals.bank_hq_address,
        telephone: vals.telephone,
        ownership: vals.ownership,
        established: vals.established,
        website: vals.website,
        circular_ref: vals.circular_ref,
        change_remarks: vals.change_remarks,
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

  const columns: ColumnsType<Bank> = useMemo(
    () => [
      { title: t("master.col.bank_name"), dataIndex: "bank_name", key: "bank_name", width: 220, render: (v) => <span style={WRAP}>{v}</span> },
      { title: t("bankMaster.bankKey"), dataIndex: "bank_key", key: "bank_key", width: 88 },
      { title: t("bankMaster.branchName"), dataIndex: "branch_name", key: "branch_name", width: 200, render: (v) => <span style={WRAP}>{v}</span> },
      { title: t("master.col.bank_code"), dataIndex: "bank_code", key: "bank_code", width: 100 },
      { title: t("bankMaster.category"), dataIndex: "category", key: "category", width: 160, render: (v) => <span style={WRAP}>{v ?? "—"}</span> },
      { title: t("bankMaster.abbrev"), dataIndex: "bank_abbrev", key: "bank_abbrev", width: 72, render: (v) => v ?? "—" },
      { title: t("bankMaster.city"), dataIndex: "city", key: "city", width: 120, render: (v) => <span style={WRAP}>{v ?? "—"}</span> },
      { title: t("master.col.swift_code"), dataIndex: "swift_code", key: "swift_code", width: 120, render: (v) => v ?? "—" },
      { title: t("bankMaster.branchAddress"), dataIndex: "branch_address", key: "branch_address", width: 200, render: (v) => <span style={WRAP}>{v ?? "—"}</span> },
      { title: t("bankMaster.bankHqAddress"), dataIndex: "bank_hq_address", key: "bank_hq_address", width: 200, render: (v) => <span style={WRAP}>{v ?? "—"}</span> },
      { title: t("bankMaster.telephone"), dataIndex: "telephone", key: "telephone", width: 120, render: (v) => v ?? "—" },
      { title: t("bankMaster.ownership"), dataIndex: "ownership", key: "ownership", width: 180, render: (v) => <span style={WRAP}>{v ?? "—"}</span> },
      { title: t("bankMaster.established"), dataIndex: "established", key: "established", width: 100, render: (v) => v ?? "—" },
      { title: t("bankMaster.website"), dataIndex: "website", key: "website", width: 140, render: (v) => <span style={WRAP}>{v ?? "—"}</span> },
      { title: t("bankMaster.effectiveFrom"), key: "effective_from", width: 110, render: (_v, row) => fmtDate(row.effective_from) },
      { title: t("bankMaster.effectiveTo"), key: "effective_to", width: 110, render: (_v, row) => fmtDate(row.effective_to) },
      { title: t("bankMaster.lastUpdated"), key: "last_updated", width: 110, render: (_v, row) => fmtDate(row.last_updated) },
      { title: t("bankMaster.lastUpdatedBy"), dataIndex: "last_updated_by", key: "last_updated_by", width: 120, render: (v) => <span style={WRAP}>{v ?? "—"}</span> },
      { title: t("bankMaster.circularRef"), dataIndex: "circular_ref", key: "circular_ref", width: 160, render: (v) => <span style={WRAP}>{v ?? "—"}</span> },
      { title: t("bankMaster.changeRemarks"), dataIndex: "change_remarks", key: "change_remarks", width: 180, render: (v) => <span style={WRAP}>{v ?? "—"}</span> },
      {
        title: t("master.col.is_active"),
        dataIndex: "is_active",
        key: "is_active",
        width: 90,
        fixed: "right",
        render: (active: boolean) =>
          active ? <Tag color="green">{t("master.tag_active")}</Tag> : <Tag color="red">{t("master.tag_inactive")}</Tag>,
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
    [canEdit, openEdit, t],
  );

  const drawerOpen = mode !== null;

  const label = (k: string) => (
    <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>{k}</label>
  );

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
        <Space align="center" wrap>
          <span style={{ color: "#666" }}>{t("master.show_filter")}</span>
          <Segmented
            options={[
              { label: t("master.filter_all"), value: "all" },
              { label: t("master.filter_active_only"), value: "active" },
            ]}
            value={showActiveOnly ? "active" : "all"}
            onChange={(v) => setShowActiveOnly(v === "active")}
          />
          <Input.Search
            allowClear
            placeholder={t("bankMaster.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: 360 }}
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
            rowKey={(r) => `${r.bank_name}|${r.bank_code}`}
            columns={columns}
            dataSource={q.data?.items ?? []}
            pagination={{
              current: page,
              pageSize: pageSize,
              total: q.data?.total ?? 0,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50"],
              showTotal: (total) => t("bankMaster.totalRows", { count: total }),
              onChange: (newPage, newSize) => {
                setPage(newPage);
                setPageSize(newSize);
              },
            }}
            scroll={{ x: 3400 }}
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
        width={480}
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
              {label(t("master.col.bank_name"))}
              <Input value={editing.bank_name} disabled style={{ ...INPUT_STYLE, background: "#EEE" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("bankMaster.branchName"))}
              <Input value={editing.branch_name} disabled style={{ ...INPUT_STYLE, background: "#EEE" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("master.col.bank_code"))}
              <Input value={editing.bank_code} disabled style={{ ...INPUT_STYLE, background: "#EEE" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("master.col.swift_code"))}
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
            <div style={{ marginBottom: 12 }}>
              {label(t("bankMaster.category"))}
              <Controller
                name="category"
                control={editForm.control}
                render={({ field }) => <Input {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} style={INPUT_STYLE} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("bankMaster.abbrev"))}
              <Controller
                name="bank_abbrev"
                control={editForm.control}
                render={({ field }) => <Input {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} style={INPUT_STYLE} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("bankMaster.city"))}
              <Controller
                name="city"
                control={editForm.control}
                render={({ field }) => <Input {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} style={INPUT_STYLE} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("bankMaster.branchAddress"))}
              <Controller
                name="branch_address"
                control={editForm.control}
                render={({ field }) => <Input.TextArea rows={2} {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} style={INPUT_STYLE} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("bankMaster.bankHqAddress"))}
              <Controller
                name="bank_hq_address"
                control={editForm.control}
                render={({ field }) => <Input.TextArea rows={2} {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} style={INPUT_STYLE} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("bankMaster.telephone"))}
              <Controller
                name="telephone"
                control={editForm.control}
                render={({ field }) => <Input {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} style={INPUT_STYLE} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("bankMaster.ownership"))}
              <Controller
                name="ownership"
                control={editForm.control}
                render={({ field }) => <Input.TextArea rows={2} {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} style={INPUT_STYLE} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("bankMaster.established"))}
              <Controller
                name="established"
                control={editForm.control}
                render={({ field }) => <Input {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} style={INPUT_STYLE} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("bankMaster.website"))}
              <Controller
                name="website"
                control={editForm.control}
                render={({ field }) => <Input {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} style={INPUT_STYLE} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("bankMaster.circularRef"))}
              <Controller
                name="circular_ref"
                control={editForm.control}
                render={({ field }) => <Input {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} style={INPUT_STYLE} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("bankMaster.changeRemarks"))}
              <Controller
                name="change_remarks"
                control={editForm.control}
                render={({ field }) => <Input.TextArea rows={2} {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} style={INPUT_STYLE} />}
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
              {label(t("master.col.bank_name"))}
              <Controller
                name="bank_name"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("master.col.bank_code"))}
              <Controller
                name="bank_code"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              {label(t("master.col.swift_code"))}
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
