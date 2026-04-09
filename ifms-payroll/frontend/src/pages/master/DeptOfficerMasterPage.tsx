/** Screen: `DeptOfficerMasterPage` — page-level UI and mutations. */
import { PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Drawer,
  Form,
  Input,
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
  useCreateDeptOfficerScope,
  useDeleteDeptOfficerScope,
  useDeptOfficerScopes,
  useEmployeeCounts,
  useUsersByRole,
  type DeptOfficerScopeRow,
} from "@/api/masterScope";
import { useDepartments } from "@/api/lookups";

export function DeptOfficerMasterPage() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DeptOfficerScopeRow | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form] = Form.useForm<{ user_id: string; department_name: string }>();

  const { data, isLoading } = useDeptOfficerScopes({
    page,
    pageSize,
    search: debouncedSearch,
    activeOnly: showActiveOnly,
  });
  const rows = data?.items ?? [];
  const empCounts = useEmployeeCounts();

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, showActiveOnly]);
  const createMut = useCreateDeptOfficerScope();
  const deleteMut = useDeleteDeptOfficerScope();
  const { data: officers = [] } = useUsersByRole("ROLE_DEPT_OFFICER");

  const { data: departments = [] } = useDepartments();

  useEffect(() => {
    if (!open || !editingRecord) return;
    form.setFieldsValue({
      user_id: editingRecord.user_id,
      department_name: editingRecord.department_name,
    });
  }, [open, editingRecord, form]);

  const handleEdit = useCallback((record: DeptOfficerScopeRow) => {
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
          department_name: vals.department_name,
        });
        message.success(t("deptOfficerMaster.scopeUpdated"));
        closeDrawer();
        return;
      }
      await createMut.mutateAsync({
        user_id: vals.user_id,
        department_name: vals.department_name,
      });
      message.success(t("deptOfficerMaster.scopeSaved"));
      closeDrawer();
    } catch (err) {
      if (duplicateScopeError(err)) {
        message.error(t("deptOfficerMaster.duplicateScope"));
      } else {
        message.error(t("login.error.generic"));
      }
    }
  }, [closeDrawer, createMut, deleteMut, editingRecord, form, t]);

  const pending = createMut.isPending || deleteMut.isPending;

  const columns: ColumnsType<DeptOfficerScopeRow> = useMemo(
    () => [
      { title: t("deptOfficerMaster.officerName"), dataIndex: "full_name", key: "full_name" },
      { title: t("user.username"), dataIndex: "username", key: "username" },
      { title: t("deptOfficerMaster.department"), dataIndex: "department_name", key: "department_name" },
      {
        title: t("master.col_employees"),
        key: "emp_count",
        render: (_, record) => empCounts?.data?.by_department?.[record.department_name] ?? 0,
      },
      {
        title: t("deptOfficerMaster.active"),
        dataIndex: "is_active",
        key: "is_active",
        render: (v: boolean) =>
          v ? (
            <Tag color="green">{t("master.tag_active")}</Tag>
          ) : (
            <Tag color="red">{t("master.tag_inactive")}</Tag>
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
                title={t("deptOfficerMaster.removeConfirm")}
                okButtonProps={{ danger: true }}
                onConfirm={() => {
                  deleteMut.mutate(record.id, {
                    onSuccess: () => message.success(t("deptOfficerMaster.scopeRemoved")),
                    onError: () => message.error(t("login.error.generic")),
                  });
                }}
              >
                <Button type="link" danger size="small" loading={deleteMut.isPending}>
                  {t("deptOfficerMaster.removeOfficer")}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        ),
      },
    ],
    [deleteMut, empCounts?.data?.by_department, handleEdit, t],
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t("deptOfficerMaster.title")}
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
          {t("deptOfficerMaster.addOfficer")}
        </Button>
      </div>

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
            placeholder={t("deptOfficerMaster.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: 360 }}
          />
        </Space>
      </div>

      <Spin spinning={isLoading}>
        <Table<DeptOfficerScopeRow>
          rowKey="id"
          loading={false}
          columns={columns}
          dataSource={rows}
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (total) => t("deptOfficerMaster.totalRows", { count: total }),
            onChange: (newPage, newSize) => {
              setPage(newPage);
              setPageSize(newSize);
            },
          }}
          locale={{ emptyText: t("deptOfficerMaster.noOfficers") }}
        />
      </Spin>

      <Drawer
        title={editingRecord ? t("common.edit") : t("deptOfficerMaster.addOfficer")}
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
          <Form.Item name="user_id" label={t("deptOfficerMaster.officer")} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={officers.map((u) => ({
                value: u.user_id,
                label: `${u.full_name} (${u.username})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="department_name" label={t("deptOfficerMaster.department")} rules={[{ required: true }]}>
            <Select options={departments.map((d) => ({ value: d, label: d }))} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
