/** Screen: `RegistrationsPage` — page-level UI and mutations. */
import { Button, Input, Modal, Space, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useApproveRegistration,
  useRegistrations,
  useRejectRegistration,
  type RegistrationRow,
} from "@/api/admin";

export function RegistrationsPage() {
  const { t } = useTranslation();
  const { data: regData, isLoading } = useRegistrations(1, 100);
  const approveMut = useApproveRegistration();
  const rejectMut = useRejectRegistration();

  const [tempPwd, setTempPwd] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectUid, setRejectUid] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const rows = regData?.data ?? [];

  const columns: ColumnsType<RegistrationRow> = [
    { title: t("user.fullName"), dataIndex: "full_name", key: "full_name" },
    { title: t("user.email"), dataIndex: "email", key: "email" },
    { title: t("registrations.colSso"), dataIndex: "sso_number", key: "sso_number" },
    { title: t("registrations.colLocation"), dataIndex: "location", key: "location" },
    { title: t("registrations.colDepartment"), dataIndex: "department_name", key: "department_name" },
    {
      title: t("registrations.colSubmitted"),
      dataIndex: "submitted_at",
      key: "submitted_at",
      render: (v: string | null) => (v ? new Date(v).toLocaleString() : "—"),
    },
    { title: t("user.status"), dataIndex: "registration_status", key: "registration_status" },
    {
      title: t("user.actions"),
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            style={{ background: "#2e7d32", borderColor: "#2e7d32" }}
            loading={approveMut.isPending}
            onClick={() => {
              approveMut.mutate(record.user_id, {
                onSuccess: (res) => {
                  setTempPwd(res.temp_password);
                },
                onError: () => message.error(t("login.error.generic")),
              });
            }}
          >
            {t("registrations.approve")}
          </Button>
          <Button
            danger
            size="small"
            loading={rejectMut.isPending}
            onClick={() => {
              setRejectUid(record.user_id);
              setRejectReason("");
              setRejectOpen(true);
            }}
          >
            {t("registrations.reject")}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={3}>{t("registrations.title")}</Typography.Title>
      <Table<RegistrationRow>
        rowKey="user_id"
        loading={isLoading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: t("registrations.noRegistrations") }}
      />

      <Modal
        open={tempPwd !== null}
        title={t("registrations.tempPwdTitle")}
        onCancel={() => setTempPwd(null)}
        footer={[
          <Button key="ok" type="primary" onClick={() => setTempPwd(null)}>
            {t("common.confirm")}
          </Button>,
        ]}
      >
        <p>{t("registrations.tempPwdMessage")}</p>
        <Typography.Paragraph copyable={{ text: tempPwd ?? "" }} code>
          {tempPwd}
        </Typography.Paragraph>
        <Typography.Text type="secondary">{t("user.tempPwdWarning")}</Typography.Text>
      </Modal>

      <Modal
        open={rejectOpen}
        title={t("registrations.reject")}
        onCancel={() => setRejectOpen(false)}
        onOk={() => {
          if (!rejectUid) return;
          rejectMut.mutate(
            { userId: rejectUid, reason: rejectReason || undefined },
            {
              onSuccess: () => {
                message.success(t("registrations.rejectedOk"));
                setRejectOpen(false);
              },
              onError: () => message.error(t("login.error.generic")),
            },
          );
        }}
        confirmLoading={rejectMut.isPending}
      >
        <p>{t("registrations.rejectReason")}</p>
        <Input.TextArea
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder={t("registrations.rejectReason")}
        />
      </Modal>
    </div>
  );
}
