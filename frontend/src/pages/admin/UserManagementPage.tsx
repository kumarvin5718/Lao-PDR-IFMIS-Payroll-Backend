import {
  CopyOutlined,
  EditOutlined,
  HistoryOutlined,
  KeyOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Button,
  Descriptions,
  Drawer,
  Form,
  Grid,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useCreateUser,
  useLoginHistory,
  useResetPassword,
  useUpdateUserMutation,
  useUsers,
  type AppRole,
  type UserCreatePayload,
  type UserListItem,
  type UserUpdatePayload,
} from "@/api/admin";
import { ROLES } from "@/config/constants";

const PAGE_SIZE = 50;

const ROLE_COLORS: Record<string, string> = {
  ROLE_EMPLOYEE: "blue",
  ROLE_MANAGER: "green",
  ROLE_DEPT_OFFICER: "orange",
  ROLE_ADMIN: "red",
};

const ROLE_OPTIONS = (Object.values(ROLES) as AppRole[]).map((r) => ({
  labelKey: `roles.${r}`,
  value: r,
}));

export function UserManagementPage() {
  const { t } = useTranslation();
  const screens = Grid.useBreakpoint();
  const compact = screens.md === false;

  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserListItem | null>(null);
  const [historyUser, setHistoryUser] = useState<UserListItem | null>(null);
  const [tempPwdModal, setTempPwdModal] = useState<{ open: boolean; password: string }>({
    open: false,
    password: "",
  });

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: envelope, isFetching } = useUsers(page, PAGE_SIZE);
  const rows = envelope?.data ?? [];
  const total = envelope?.pagination?.total ?? 0;

  const createMut = useCreateUser();
  const updateMut = useUpdateUserMutation();
  const resetMut = useResetPassword();

  const historyQuery = useLoginHistory(historyUser?.user_id ?? null);

  useEffect(() => {
    if (!editUser) return;
    editForm.setFieldsValue({
      role: editUser.role,
      is_active: editUser.is_active,
      preferred_language: editUser.preferred_language || "en",
    });
  }, [editUser, editForm]);

  const buildUpdatePayload = (values: {
    role: AppRole;
    is_active: boolean;
    preferred_language?: string;
  }): UserUpdatePayload => ({
    role: values.role,
    is_active: values.is_active,
    preferred_language: values.preferred_language,
  });

  const handleCreate = async (values: {
    username: string;
    full_name: string;
    email: string;
    role: AppRole;
    preferred_language?: string;
  }) => {
    const payload: UserCreatePayload = {
      username: values.username.trim(),
      full_name: values.full_name.trim(),
      email: values.email.trim(),
      role: values.role,
      preferred_language: values.preferred_language || "en",
    };
    try {
      const res = await createMut.mutateAsync(payload);
      setCreateOpen(false);
      createForm.resetFields();
      message.success(t("user.createSuccess"));
      setTempPwdModal({ open: true, password: res.temp_password });
    } catch {
      message.error(t("user.errorGeneric"));
    }
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    try {
      const values = await editForm.validateFields();
      await updateMut.mutateAsync({
        userId: editUser.user_id,
        payload: buildUpdatePayload(values),
      });
      message.success(t("user.updateSuccess"));
      setEditUser(null);
    } catch (e) {
      if (e && typeof e === "object" && "errorFields" in e) return;
      message.error(t("user.errorGeneric"));
    }
  };

  const handleReset = async (user: UserListItem) => {
    try {
      const res = await resetMut.mutateAsync(user.user_id);
      message.success(t("user.resetSuccess"));
      setTempPwdModal({ open: true, password: res.temp_password });
    } catch {
      message.error(t("user.errorGeneric"));
    }
  };

  const copyTempPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempPwdModal.password);
      message.success(t("user.copied"));
    } catch {
      message.error(t("user.copyFailed"));
    }
  };

  const columns: ColumnsType<UserListItem> = [
    {
      title: t("user.username"),
      dataIndex: "username",
      key: "username",
      ellipsis: true,
    },
    {
      title: t("user.fullName"),
      dataIndex: "full_name",
      key: "full_name",
      ellipsis: true,
      responsive: ["md"],
    },
    {
      title: t("user.email"),
      dataIndex: "email",
      key: "email",
      ellipsis: true,
      responsive: ["lg"],
    },
    {
      title: t("user.role"),
      dataIndex: "role",
      key: "role",
      width: compact ? 120 : 160,
      render: (role: string) => (
        <Tag color={ROLE_COLORS[role] ?? "default"}>{t(`roles.${role}`)}</Tag>
      ),
    },
    {
      title: t("user.language"),
      dataIndex: "preferred_language",
      key: "preferred_language",
      width: 88,
      responsive: ["lg"],
    },
    {
      title: t("user.status"),
      dataIndex: "is_active",
      key: "is_active",
      width: 88,
      render: (active: boolean) => (
        <Tag color={active ? "green" : "default"}>{active ? t("common.yes") : t("common.no")}</Tag>
      ),
    },
    {
      title: t("user.lastLogin"),
      dataIndex: "last_login",
      key: "last_login",
      width: 156,
      responsive: ["xl"],
      render: (v: string | null) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm") : t("user.never")),
    },
    {
      title: t("user.actions"),
      key: "actions",
      width: compact ? 120 : 200,
      fixed: "right",
      render: (_, record) => (
        <Space size={0} wrap>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setEditUser(record)}
          >
            {compact ? undefined : t("common.edit")}
          </Button>
          <Popconfirm
            title={t("user.resetPwd")}
            description={t("user.resetPwdConfirm")}
            onConfirm={() => void handleReset(record)}
            okText={t("common.confirm")}
            cancelText={t("common.cancel")}
          >
            <Button type="link" size="small" danger icon={<KeyOutlined />}>
              {compact ? undefined : t("user.resetPwd")}
            </Button>
          </Popconfirm>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => setHistoryUser(record)}
          >
            {compact ? undefined : t("user.history")}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space align="start" style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t("user.title")}
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          {t("user.addUser")}
        </Button>
      </Space>

      <Table<UserListItem>
        rowKey="user_id"
        loading={isFetching}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 960 }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
          showTotal: (n) => t("user.paginationTotal", { total: n }),
        }}
      />

      <Modal
        title={t("user.createModalTitle")}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        destroyOnClose
        width={520}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(v) => void handleCreate(v)}
          initialValues={{ preferred_language: "en", role: ROLES.ADMIN }}
        >
          <Form.Item
            name="username"
            label={t("user.username")}
            rules={[{ required: true, message: t("user.validationRequired") }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="full_name"
            label={t("user.fullName")}
            rules={[{ required: true, message: t("user.validationRequired") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label={t("user.email")}
            rules={[
              { required: true, message: t("user.validationRequired") },
              { type: "email", message: t("user.validationEmail") },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="role"
            label={t("user.role")}
            rules={[{ required: true, message: t("user.validationRequired") }]}
          >
            <Select
              options={ROLE_OPTIONS.map((o) => ({ label: t(o.labelKey), value: o.value }))}
            />
          </Form.Item>
          <Form.Item name="preferred_language" label={t("user.language")}>
            <Select
              options={[
                { label: t("user.langEn"), value: "en" },
                { label: t("user.langLo"), value: "lo" },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
              <Button type="primary" htmlType="submit" loading={createMut.isPending}>
                {t("user.createSubmit")}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={t("user.editUser")}
        width={520}
        open={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setEditUser(null)}>{t("common.cancel")}</Button>
            <Button type="primary" onClick={() => void handleEditSave()} loading={updateMut.isPending}>
              {t("common.save")}
            </Button>
          </Space>
        }
      >
        {editUser ? (
          <>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
              {t("user.readOnlyIdentity")}
            </Typography.Paragraph>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t("user.username")}>{editUser.username}</Descriptions.Item>
              <Descriptions.Item label={t("user.fullName")}>{editUser.full_name}</Descriptions.Item>
              <Descriptions.Item label={t("user.email")}>{editUser.email}</Descriptions.Item>
            </Descriptions>
            <Form form={editForm} layout="vertical">
              <Form.Item
                name="role"
                label={t("user.role")}
                rules={[{ required: true, message: t("user.validationRequired") }]}
              >
                <Select
                  options={ROLE_OPTIONS.map((o) => ({ label: t(o.labelKey), value: o.value }))}
                />
              </Form.Item>
              <Form.Item name="is_active" label={t("user.activeAccount")} valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="preferred_language" label={t("user.language")}>
                <Select
                  options={[
                    { label: t("user.langEn"), value: "en" },
                    { label: t("user.langLo"), value: "lo" },
                  ]}
                />
              </Form.Item>
            </Form>
          </>
        ) : null}
      </Drawer>

      <Drawer
        title={t("user.loginHistory")}
        width={640}
        open={Boolean(historyUser)}
        onClose={() => setHistoryUser(null)}
        destroyOnClose
      >
        {historyUser ? (
          <Typography.Paragraph>
            <strong>{historyUser.username}</strong> — {historyUser.full_name}
          </Typography.Paragraph>
        ) : null}
        <Table
          rowKey={(r) => String(r.id)}
          loading={historyQuery.isFetching}
          dataSource={historyQuery.data ?? []}
          pagination={false}
          locale={{ emptyText: t("user.noHistory") }}
          columns={[
            {
              title: t("user.when"),
              dataIndex: "login_at",
              key: "login_at",
              render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm:ss"),
            },
            {
              title: t("user.ipAddress"),
              dataIndex: "ip_address",
              key: "ip_address",
              ellipsis: true,
              render: (v: string | null) => v ?? "—",
            },
            {
              title: t("user.userAgent"),
              dataIndex: "user_agent",
              key: "user_agent",
              ellipsis: true,
              render: (v: string | null) => v ?? "—",
            },
          ]}
        />
      </Drawer>

      <Modal
        title={t("user.tempPwdTitle")}
        open={tempPwdModal.open}
        onOk={() => setTempPwdModal({ open: false, password: "" })}
        onCancel={() => setTempPwdModal({ open: false, password: "" })}
        okText={t("user.close")}
        cancelButtonProps={{ style: { display: "none" } }}
      >
        <Typography.Paragraph type="secondary">{t("user.tempPwdWarning")}</Typography.Paragraph>
        <Input.TextArea value={tempPwdModal.password} readOnly autoSize={{ minRows: 2, maxRows: 4 }} />
        <Button
          type="primary"
          icon={<CopyOutlined />}
          onClick={() => void copyTempPassword()}
          style={{ marginTop: 12 }}
        >
          {t("user.copyPassword")}
        </Button>
      </Modal>
    </div>
  );
}
