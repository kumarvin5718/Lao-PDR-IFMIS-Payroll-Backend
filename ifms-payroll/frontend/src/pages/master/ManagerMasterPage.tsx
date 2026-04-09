/** Screen: `ManagerMasterPage` — page-level UI and mutations. */
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useCreateManagerScopeBatch,
  useDeleteManagerScope,
  useEmployeeCounts,
  useManagerScopes,
  useManagerScopesForUser,
  useReplaceManagerScopes,
  useUsersByRole,
  type ManagerScopeRow,
} from "@/api/masterScope";
import { useDepartments, useProvinces } from "@/api/lookups";

type ScopeLine = { location?: string; department_name?: string };

export function ManagerMasterPage() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  /** When set, drawer edits all scope rows for this manager (multi location/department). */
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form] = Form.useForm<{
    user_id: string;
    scopes?: ScopeLine[];
  }>();

  const { data, isLoading } = useManagerScopes({
    page,
    pageSize,
    search: debouncedSearch,
    activeOnly: showActiveOnly,
  });
  const rows = data?.items ?? [];
  const empCounts = useEmployeeCounts();

  const scopesForEdit = useManagerScopesForUser(editingUserId, {
    enabled: open && !!editingUserId,
  });

  const seededEditFormForUser = useRef<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, showActiveOnly]);

  const createBatchMut = useCreateManagerScopeBatch();
  const replaceMut = useReplaceManagerScopes();
  const deleteMut = useDeleteManagerScope();
  const { data: managers = [] } = useUsersByRole("ROLE_MANAGER");

  const { data: provinces = [] } = useProvinces();
  const { data: departments = [], isFetching: departmentsLoading } = useDepartments();

  useEffect(() => {
    if (!open || !editingUserId) {
      seededEditFormForUser.current = null;
      return;
    }
    if (!scopesForEdit.isSuccess || !scopesForEdit.data) return;
    if (seededEditFormForUser.current === editingUserId) return;
    seededEditFormForUser.current = editingUserId;
    const lines = scopesForEdit.data.map((s) => ({
      location: s.location,
      department_name: s.department_name,
    }));
    form.setFieldsValue({
      user_id: editingUserId,
      scopes: lines.length > 0 ? lines : [{}],
    });
  }, [open, editingUserId, scopesForEdit.isSuccess, scopesForEdit.data, form]);

  const handleEdit = useCallback((record: ManagerScopeRow) => {
    setEditingUserId(record.user_id);
    setOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    seededEditFormForUser.current = null;
    setOpen(false);
    setEditingUserId(null);
    form.resetFields();
  }, [form]);

  const duplicateScopeError = (err: unknown) =>
    isAxiosError(err) &&
    err.response?.data &&
    typeof err.response.data === "object" &&
    "error" in err.response.data &&
    (err.response.data as { error?: { code?: string } }).error?.code === "ERR_MANAGER_SCOPE_DUPLICATE";

  const showBatchResultMessage = useCallback(
    (res: { created: number; skipped_duplicates: number }) => {
      if (res.created === 0 && res.skipped_duplicates > 0) {
        message.warning(t("managerMaster.batchAllDuplicates"));
      } else if (res.skipped_duplicates > 0) {
        message.success(
          t("managerMaster.batchSavedPartial", {
            created: res.created,
            skipped: res.skipped_duplicates,
          }),
        );
      } else {
        message.success(t("managerMaster.batchSaved", { count: res.created }));
      }
    },
    [t],
  );

  const handleSubmit = useCallback(async () => {
    try {
      const vals = await form.validateFields();
      const raw = vals.scopes ?? [];
      for (const s of raw) {
        const hasL = Boolean(s?.location?.trim());
        const hasD = Boolean(s?.department_name?.trim());
        if (hasL !== hasD) {
          message.warning(t("managerMaster.completeEachPair"));
          return;
        }
      }
      const scopes = raw
        .filter((s) => s?.location?.trim() && s?.department_name?.trim())
        .map((s) => ({
          location: s.location!.trim(),
          department_name: s.department_name!.trim(),
        }));
      if (scopes.length === 0) {
        message.warning(t("managerMaster.atLeastOnePair"));
        return;
      }

      if (editingUserId) {
        if (vals.user_id !== editingUserId) {
          message.error(t("managerMaster.userMismatch"));
          return;
        }
        const res = await replaceMut.mutateAsync({
          user_id: editingUserId,
          scopes,
        });
        showBatchResultMessage(res);
      } else {
        const res = await createBatchMut.mutateAsync({
          user_id: vals.user_id,
          scopes,
        });
        showBatchResultMessage(res);
      }
      setPage(1);
      closeDrawer();
    } catch (err) {
      if (duplicateScopeError(err)) {
        message.error(t("managerMaster.duplicateScope"));
      } else {
        message.error(t("login.error.generic"));
      }
    }
  }, [
    closeDrawer,
    createBatchMut,
    editingUserId,
    form,
    replaceMut,
    showBatchResultMessage,
    t,
  ]);

  const pending = createBatchMut.isPending || replaceMut.isPending || deleteMut.isPending;

  const columns: ColumnsType<ManagerScopeRow> = useMemo(
    () => [
      { title: t("managerMaster.managerName"), dataIndex: "full_name", key: "full_name" },
      { title: t("user.username"), dataIndex: "username", key: "username" },
      { title: t("managerMaster.location"), dataIndex: "location", key: "location" },
      { title: t("managerMaster.department"), dataIndex: "department_name", key: "department_name" },
      {
        title: t("master.col_employees_tagged"),
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

  const drawerLoading = Boolean(editingUserId) && (scopesForEdit.isLoading || scopesForEdit.isFetching);

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
            setEditingUserId(null);
            form.resetFields();
            form.setFieldsValue({ scopes: [{}] });
            setOpen(true);
          }}
        >
          {t("managerMaster.addScope")}
        </Button>
      </div>

      <Typography.Paragraph type="secondary" style={{ marginBottom: 16, maxWidth: 720 }}>
        {t("managerMaster.introMulti")}
      </Typography.Paragraph>

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
            placeholder={t("managerMaster.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: 360 }}
          />
        </Space>
      </div>

      <Spin spinning={isLoading}>
        <Table<ManagerScopeRow>
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
            showTotal: (total) => t("managerMaster.totalRows", { count: total }),
            onChange: (newPage, newSize) => {
              setPage(newPage);
              setPageSize(newSize);
            },
          }}
          locale={{ emptyText: t("managerMaster.noManagers") }}
        />
      </Spin>

      <Drawer
        title={editingUserId ? t("managerMaster.editScopeMulti") : t("managerMaster.addScopeMulti")}
        open={open}
        onClose={closeDrawer}
        width={520}
        destroyOnClose
        footer={
          <Space style={{ float: "right" }}>
            <Button onClick={closeDrawer}>{t("common.cancel")}</Button>
            <Button type="primary" loading={pending} disabled={drawerLoading} onClick={() => void handleSubmit()}>
              {t("common.save")}
            </Button>
          </Space>
        }
      >
        <Spin spinning={drawerLoading}>
          {scopesForEdit.isError ? (
            <Typography.Text type="danger">{t("managerMaster.loadScopesFailed")}</Typography.Text>
          ) : null}
          <Form form={form} layout="vertical">
            <Form.Item name="user_id" label={t("managerMaster.manager")} rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                disabled={Boolean(editingUserId)}
                options={managers.map((u) => ({
                  value: u.user_id,
                  label: `${u.full_name} (${u.username})`,
                }))}
              />
            </Form.Item>

            <Form.List name="scopes">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <div
                      key={field.key}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                        marginBottom: 12,
                        paddingBottom: 12,
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Form.Item
                          name={[field.name, "location"]}
                          label={t("managerMaster.location")}
                          style={{ marginBottom: 8 }}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            options={provinces.map((p) => ({ value: p, label: p }))}
                            placeholder={t("managerMaster.pickLocation")}
                            onChange={() =>
                              form.setFieldValue(["scopes", field.name, "department_name"], undefined)
                            }
                          />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, "department_name"]}
                          label={t("managerMaster.department")}
                          style={{ marginBottom: 0 }}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            loading={departmentsLoading}
                            placeholder={t("managerMaster.pickDepartment")}
                            options={departments.map((d) => ({ value: d, label: d }))}
                          />
                        </Form.Item>
                      </div>
                      {fields.length > 1 ? (
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(field.name)}
                          style={{ marginTop: 30 }}
                          aria-label={t("managerMaster.removePair")}
                        />
                      ) : null}
                    </div>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    {t("managerMaster.addAnotherPair")}
                  </Button>
                </>
              )}
            </Form.List>
          </Form>
        </Spin>
      </Drawer>
    </div>
  );
}
