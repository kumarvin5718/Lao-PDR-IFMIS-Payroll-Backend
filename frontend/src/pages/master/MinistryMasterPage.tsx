/** Screen: `MinistryMasterPage` — ministry master list and edit (Ant Design Table). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, Modal, Select, Space, Switch, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchMinistriesMaster, updateMinistryMaster, type MinistryMasterRow } from "@/api/master";
import { ROLES } from "@/config/constants";
import { useAuthStore } from "@/store/authStore";

const FIELD_ALLOWANCE_OPTIONS = [
  { value: "Teaching", label: "Teaching" },
  { value: "Medical", label: "Medical" },
];

export function MinistryMasterPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === ROLES.ADMIN;

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<MinistryMasterRow | null>(null);
  const [form] = Form.useForm<{
    ministry_name: string;
    profession_category: string;
    na_allowance_eligible: boolean;
    field_allowance_type: string | null;
    circular_ref: string;
  }>();

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const q = useQuery({
    queryKey: ["master", "ministry", page, pageSize, debouncedSearch],
    queryFn: async () => {
      const res = await fetchMinistriesMaster({
        page,
        size: pageSize,
        search: debouncedSearch || undefined,
      });
      if (!res.success || !res.data) throw new Error("load");
      return res.data;
    },
    staleTime: 60_000,
  });

  const updateMut = useMutation({
    mutationFn: async (vals: {
      ministry_name: string;
      profession_category: string;
      na_allowance_eligible: boolean;
      field_allowance_type: string | null;
      circular_ref: string;
    }) => {
      if (!editing) return;
      const res = await updateMinistryMaster(editing.ministry_key, {
        ministry_name: vals.ministry_name,
        profession_category: vals.profession_category?.trim() || null,
        na_allowance_eligible: vals.na_allowance_eligible,
        field_allowance_type: vals.field_allowance_type ?? null,
        circular_ref: vals.circular_ref?.trim() || null,
      });
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("master.saved_ok"));
      await qc.invalidateQueries({ queryKey: ["master", "ministry"] });
      await qc.invalidateQueries({ queryKey: ["lookups", "ministries"] });
      setEditOpen(false);
      setEditing(null);
    },
    onError: () => message.error(t("login.error.generic")),
  });

  const openEdit = useCallback(
    (row: MinistryMasterRow) => {
      setEditing(row);
      form.setFieldsValue({
        ministry_name: row.ministry_name,
        profession_category: row.profession_category ?? "",
        na_allowance_eligible: row.na_allowance_eligible,
        field_allowance_type: row.field_allowance_type,
        circular_ref: row.circular_ref ?? "",
      });
      setEditOpen(true);
    },
    [form],
  );

  const columns: ColumnsType<MinistryMasterRow> = useMemo(
    () => [
      { title: t("ministryMaster.ministryKey"), dataIndex: "ministry_key", key: "ministry_key", width: 100 },
      { title: t("ministryMaster.ministryName"), dataIndex: "ministry_name", key: "ministry_name" },
      {
        title: t("ministryMaster.profCategory"),
        dataIndex: "profession_category",
        key: "profession_category",
        width: 140,
      },
      {
        title: t("ministryMaster.naEligible"),
        dataIndex: "na_allowance_eligible",
        key: "na_allowance_eligible",
        width: 100,
        render: (v: boolean) => (v ? t("common.yes") : t("common.no")),
      },
      {
        title: t("ministryMaster.fieldAllowance"),
        dataIndex: "field_allowance_type",
        key: "field_allowance_type",
        width: 130,
        render: (v: string | null) => v || "—",
      },
      {
        title: t("ministryMaster.effectiveFrom"),
        dataIndex: "effective_from",
        key: "effective_from",
        width: 120,
        render: (v: string | null) => (v ? dayjs(v).format("DD/MM/YYYY") : "—"),
      },
      {
        title: t("ministryMaster.circularRef"),
        dataIndex: "circular_ref",
        key: "circular_ref",
        width: 200,
        ellipsis: true,
      },
      {
        title: t("user.actions"),
        key: "actions",
        width: 90,
        fixed: "right",
        render: (_, row) =>
          canEdit ? (
            <Button type="link" size="small" onClick={() => openEdit(row)}>
              {t("common.edit")}
            </Button>
          ) : null,
      },
    ],
    [canEdit, openEdit, t],
  );

  return (
    <div style={{ padding: 24, background: "#F7F8FA", minHeight: "100%" }}>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        {t("page.master.ministry.title")}
      </Typography.Title>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          allowClear
          placeholder={t("ministryMaster.searchPlaceholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ width: 360 }}
        />
      </Space>

      <div
        style={{
          background: "#FFFFFF",
          border: "0.5px solid #DDE1EA",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <Table<MinistryMasterRow>
          rowKey="ministry_key"
          loading={q.isFetching}
          columns={columns}
          dataSource={q.data?.items ?? []}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize,
            total: q.data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (total) => t("ministryMaster.totalRows", { count: total }),
            onChange: (newPage, newSize) => {
              setPage(newPage);
              setPageSize(newSize);
            },
          }}
          size="middle"
        />
      </div>

      <Modal
        title={t("common.edit")}
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        destroyOnClose
        okText={t("common.save")}
        cancelText={t("common.cancel")}
        confirmLoading={updateMut.isPending}
        onOk={() => void form.validateFields().then((vals) => updateMut.mutate(vals))}
      >
        <Form form={form} layout="vertical">
          <Form.Item label={t("ministryMaster.ministryKey")}>
            <Input value={editing?.ministry_key} disabled />
          </Form.Item>
          <Form.Item name="ministry_name" label={t("ministryMaster.ministryName")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="profession_category" label={t("ministryMaster.profCategory")}>
            <Input />
          </Form.Item>
          <Form.Item name="na_allowance_eligible" label={t("ministryMaster.naEligible")} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="field_allowance_type" label={t("ministryMaster.fieldAllowance")}>
            <Select
              allowClear
              placeholder="—"
              options={FIELD_ALLOWANCE_OPTIONS}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item name="circular_ref" label={t("ministryMaster.circularRef")}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
