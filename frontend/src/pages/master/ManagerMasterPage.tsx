import { PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Drawer,
  Form,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useCreateManagerScope,
  useDeleteManagerScope,
  useEmployeeCounts,
  useManagerScopes,
  useUsersByRole,
  type ManagerScopeRow,
} from "@/api/masterScope";
import { useDepartments, useProvinces } from "@/api/lookups";

export function ManagerMasterPage() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ManagerScopeRow | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [form] = Form.useForm<{ user_id: string; location: string; department_name: string }>();

  const { data: rows = [], isLoading } = useManagerScopes();
  const empCounts = useEmployeeCounts();
  const displayRows = useMemo(
    () => (showActiveOnly ? rows.filter((r) => r.is_active) : rows),
    [rows, showActiveOnly],
  );
  const createMut = useCreateManagerScope();
  const deleteMut = useDeleteManagerScope();
  const { data: managers = [] } = useUsersByRole("ROLE_MANAGER");

  const { data: provinces = [] } = useProvinces();
  const locationWatch = Form.useWatch("location", form);
  const effectiveLocation = locationWatch ?? editingRecord?.location;
  const { data: departments = [] } = useDepartments(effectiveLocation);

  useEffect(() => {
    if (!open || !editingRecord) return;
    form.setFieldsValue({
      user_id: editingRecord.user_id,
      location: editingRecord.location,
      department_name: editingRecord.department_name,
    });
  }, [open, editingRecord, form]);

  const handleEdit = useCallback((record: ManagerScopeRow) => {
    setEditingRecord(record);
    setOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    setEditingRecord(null);
    form.resetFields();
  }, [form]);

  const duplicateScopeError = (err: unknown) =>
    isAxiosError(err) &&
    err.response?.data &&
    typeof err.response.data === "object" &&
    "error" in err.response.data &&
    (err.response.data as { error?: { code?: string } }).error?.code === "ERR_MANAGER_SCOPE_DUPLICATE";

  const handleSubmit = useCallback(async () => {
    try {
      const vals = await form.validateFields();
      if (editingRecord) {
        await deleteMut.mutateAsync(editingRecord.id);
        await createMut.mutateAsync({
          user_id: vals.user_id,
          location: vals.location,
          department_name: vals.department_name,
        });
        message.success(t("managerMaster.scopeUpdated"));
        closeDrawer();
        return;
      }
      await createMut.mutateAsync({
        user_id: vals.user_id,
        location: vals.location,
        department_name: vals.department_name,
      });
      message.success(t("managerMaster.scopeSaved"));
      closeDrawer();
    } catch (err) {
      if (duplicateScopeError(err)) {
        message.error(t("managerMaster.duplicateScope"));
      } else {
        message.error(t("login.error.generic"));
      }
    }
  }, [closeDrawer, createMut, deleteMut, editingRecord, form, t]);

  const pending = createMut.isPending || deleteMut.isPending;

  const columns: ColumnsType<ManagerScopeRow> = useMemo(
    () => [
      { title: t("managerMaster.managerName"), dataIndex: "full_name", key: "full_name" },
      { title: t("user.username"), dataIndex: "username", key: "username" },
      { title: t("managerMaster.location"), dataIndex: "location", key: "location" },
      { title: t("managerMaster.department"), dataIndex: "department_name", key: "department_name" },
      {
        title: "Employees Tagged",
        key: "emp_count",
        render: (_, record) => {
          const key = `${record.location}||${record.department_name}`;
          return empCounts?.data?.by_manager_scope?.[key] ?? 0;
        },
      },
      {
        title: t("managerMaster.active"),
        dataIndex: "is_active",
        key: "is_active",
        render: (v: boolean) =>
          v ? (
            <Tag color="green">Active</Tag>
          ) : (
            <Tag color="red">Inactive</Tag>
          ),
      },
      {
        title: t("user.actions"),
        key: "actions",
        render: (_, record) => (
          <Space>
            <Button type="link" size="small" onClick={() => handleEdit(record)}>
              {t("common.edit")}
            </Button>
            {record.is_active ? (
              <Popconfirm
                title={t("managerMaster.removeConfirm")}
                okButtonProps={{ danger: true }}
                onConfirm={() => {
                  deleteMut.mutate(record.id, {
                    onSuccess: () => message.success(t("managerMaster.scopeRemoved")),
                    onError: () => message.error(t("login.error.generic")),
                  });
                }}
              >
                <Button type="link" danger size="small" loading={deleteMut.isPending}>
                  {t("managerMaster.removeScope")}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        ),
      },
    ],
    [deleteMut, empCounts?.data?.by_manager_scope, handleEdit, t],
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t("managerMaster.title")}
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingRecord(null);
            form.resetFields();
            setOpen(true);
          }}
        >
          {t("managerMaster.addScope")}
        </Button>
      </div>

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

      <Spin spinning={isLoading}>
        <Table<ManagerScopeRow>
          rowKey="id"
          loading={false}
          columns={columns}
          dataSource={displayRows}
          pagination={false}
          locale={{ emptyText: t("managerMaster.noManagers") }}
        />
      </Spin>

      <Drawer
        title={editingRecord ? t("common.edit") : t("managerMaster.addScope")}
        open={open}
        onClose={closeDrawer}
        width={400}
        destroyOnClose
        footer={
          <Space style={{ float: "right" }}>
            <Button onClick={closeDrawer}>{t("common.cancel")}</Button>
            <Button type="primary" loading={pending} onClick={() => void handleSubmit()}>
              {t("common.save")}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="user_id" label={t("managerMaster.manager")} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={managers.map((u) => ({
                value: u.user_id,
                label: `${u.full_name} (${u.username})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="location" label={t("managerMaster.location")} rules={[{ required: true }]}>
            <Select
              options={provinces.map((p) => ({ value: p, label: p }))}
              onChange={() => form.setFieldValue("department_name", undefined)}
            />
          </Form.Item>
          <Form.Item name="department_name" label={t("managerMaster.department")} rules={[{ required: true }]}>
            <Select
              disabled={!effectiveLocation}
              options={departments.map((d) => ({ value: d, label: d }))}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
