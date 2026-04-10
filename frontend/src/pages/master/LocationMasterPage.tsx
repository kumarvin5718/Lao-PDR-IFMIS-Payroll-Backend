/** Screen: `LocationMasterPage` — page-level UI and mutations. */
import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Drawer, Input, Segmented, Skeleton, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { isAxiosError } from "axios";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  createLocation,
  fetchLocations,
  updateLocation,
  type Location,
  type LocationCreate,
  type LocationUpdate,
} from "@/api/master";
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

type EditForm = {
  district: string;
  is_remote_area: boolean;
  is_hazardous_area: boolean;
  is_active: boolean;
};
type AddForm = LocationCreate;

const emptyAdd: AddForm = {
  district_key: "",
  country: "",
  country_key: "",
  province_key: "",
  province: "",
  district: "",
  is_remote_area: false,
  is_hazardous_area: false,
};

export function LocationMasterPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === ROLES.MANAGER || role === ROLES.ADMIN;
  const canAdd = canEdit;
  const readOnlyRole = role === ROLES.EMPLOYEE || role === ROLES.DEPT_OFFICER;

  const [mode, setMode] = useState<"edit" | "add" | null>(null);
  const [editing, setEditing] = useState<Location | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const q = useQuery({
    queryKey: ["master", "location"],
    queryFn: async () => {
      const res = await fetchLocations();
      if (!res.success || !res.data) throw new Error("load");
      return res.data;
    },
    staleTime: 300_000,
  });

  const editForm = useForm<EditForm>({
    defaultValues: { district: "", is_remote_area: false, is_hazardous_area: false, is_active: true },
  });
  const addForm = useForm<AddForm>({
    defaultValues: emptyAdd,
  });

  const openEdit = useCallback(
    (row: Location) => {
      setBanner(null);
      setEditing(row);
      setMode("edit");
      editForm.reset({
        district: row.district,
        is_remote_area: row.is_remote_area,
        is_hazardous_area: row.is_hazardous_area,
        is_active: row.is_active !== false,
      });
    },
    [editForm],
  );

  const openAdd = useCallback(() => {
    setBanner(null);
    setEditing(null);
    setMode("add");
    addForm.reset(emptyAdd);
  }, [addForm]);

  const updateMut = useMutation({
    mutationFn: async (vals: EditForm) => {
      if (!editing) return;
      const body: LocationUpdate = {
        district: vals.district,
        is_remote_area: vals.is_remote_area,
        is_hazardous_area: vals.is_hazardous_area,
        is_active: vals.is_active,
      };
      const res = await updateLocation(editing.district_key, body);
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("master.saved_ok"));
      await qc.invalidateQueries({ queryKey: ["master", "location"] });
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
      const res = await createLocation(vals);
      if (!res.success) throw new Error(res.error?.code ?? "err");
    },
    onSuccess: async () => {
      message.success(t("master.added_ok"));
      await qc.invalidateQueries({ queryKey: ["master", "location"] });
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
      .filter((r) => (showAll ? true : r.is_active !== false))
      .filter((r) => {
        if (!term) return true;
        const hay = [
          r.country,
          r.province,
          r.district,
          r.province_key,
          r.district_key,
          r.country_key,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(term);
      });
  }, [q.data, showActiveOnly, searchTerm]);

  const columns: ColumnsType<Location> = useMemo(
    () => [
      { title: t("locationMaster.country"), dataIndex: "country", key: "country", width: 160 },
      { title: t("locationMaster.countryKey"), dataIndex: "country_key", key: "country_key", width: 90 },
      { title: t("locationMaster.provinceKey"), dataIndex: "province_key", key: "province_key", width: 90 },
      { title: t("locationMaster.province"), dataIndex: "province", key: "province", width: 180 },
      { title: t("locationMaster.districtKey"), dataIndex: "district_key", key: "district_key", width: 140 },
      { title: t("locationMaster.district"), dataIndex: "district", key: "district", width: 180 },
      {
        title: t("master.col.is_active"),
        dataIndex: "is_active",
        key: "is_active",
        width: 90,
        render: (active: boolean) =>
          active ? <Tag color="green">{t("master.tag_active")}</Tag> : <Tag color="red">{t("master.tag_inactive")}</Tag>,
      },
      {
        title: t("master.col.is_remote_area"),
        dataIndex: "is_remote_area",
        key: "is_remote_area",
        width: 80,
        render: (v: boolean) => (v ? <Tag color="orange">Remote</Tag> : "—"),
      },
      {
        title: t("master.col.is_hazardous_area"),
        dataIndex: "is_hazardous_area",
        key: "is_hazardous_area",
        width: 90,
        render: (v: boolean) => (v ? <Tag color="red">Hazardous</Tag> : "—"),
      },
      {
        title: t("employee.col_actions"),
        key: "actions",
        width: 80,
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
          {t("page.master.location.title")}
        </Typography.Title>
        {canAdd && (
          <Button type="primary" style={{ background: "#1B3A6B" }} icon={<PlusOutlined />} onClick={openAdd}>
            {t("master.add_btn")}
          </Button>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space align="center" wrap>
          <Input.Search
            allowClear
            placeholder="Search country, province, district, key..."
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
          <Table<Location>
            rowKey="district_key"
            columns={columns}
            dataSource={displayRows}
            scroll={{ x: 1400 }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50"],
              showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} records`,
            }}
            size="middle"
          />
        </div>
      )}

      <Drawer
        title={
          mode === "add"
            ? `${t("master.add_btn")} — ${t("page.master.location.title")}`
            : `${t("master.edit_btn")} — ${t("page.master.location.title")}`
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
                {t("locationMaster.district")}
              </label>
              <Controller
                name="district"
                control={editForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <Controller
                name="is_remote_area"
                control={editForm.control}
                render={({ field }) => (
                  <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)}>
                    {t("master.col.is_remote_area")}
                  </Checkbox>
                )}
              />
            </div>
            <Controller
              name="is_hazardous_area"
              control={editForm.control}
              render={({ field }) => (
                <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)}>
                  {t("master.col.is_hazardous_area")}
                </Checkbox>
              )}
            />
            <div style={{ marginTop: 8 }}>
              <Controller
                name="is_active"
                control={editForm.control}
                render={({ field }) => (
                  <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)}>
                    {t("master.col.is_active")}
                  </Checkbox>
                )}
              />
            </div>
          </>
        )}
        {mode === "add" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("locationMaster.districtKey")}
              </label>
              <Controller
                name="district_key"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("locationMaster.country")}
              </label>
              <Controller
                name="country"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("locationMaster.countryKey")}
              </label>
              <Controller
                name="country_key"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("locationMaster.provinceKey")}
              </label>
              <Controller
                name="province_key"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("locationMaster.province")}
              </label>
              <Controller
                name="province"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#7A8599", marginBottom: 6 }}>
                {t("locationMaster.district")}
              </label>
              <Controller
                name="district"
                control={addForm.control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} style={{ ...INPUT_STYLE, background: "#FFFFFF" }} />}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <Controller
                name="is_remote_area"
                control={addForm.control}
                render={({ field }) => (
                  <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)}>
                    {t("master.col.is_remote_area")}
                  </Checkbox>
                )}
              />
            </div>
            <Controller
              name="is_hazardous_area"
              control={addForm.control}
              render={({ field }) => (
                <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)}>
                  {t("master.col.is_hazardous_area")}
                </Checkbox>
              )}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
