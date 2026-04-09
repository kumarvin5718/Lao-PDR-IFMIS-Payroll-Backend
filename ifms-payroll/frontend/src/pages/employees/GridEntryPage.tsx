/** Screen: `GridEntryPage` — page-level UI and mutations. */
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
ModuleRegistry.registerModules([AllCommunityModule]);

import { CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined } from "@ant-design/icons";
import type { CellValueChangedEvent, ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Button, Collapse, Modal, Space, Table, Typography, message } from "antd";
import dayjs from "dayjs";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiClient } from "@/api/client";
import {
  submitEmployeeBatch,
  type BatchCreateResponse,
  type BatchResultRow,
} from "@/api/employees";
import {
  type BranchOption,
  useAllBranches,
  useBanks,
  useDepartments,
  useProvinces,
} from "@/api/lookups";
import { ROLES } from "@/config/constants";
import { useAuth } from "@/hooks/useAuth";
import { useMinistries } from "@/hooks/useLookups";
import type { ApiEnvelope } from "@/types/auth";

type RowStatus = "empty" | "valid" | "error";

export type GridRow = {
  rowId: string;
  employee_code: string;
  title: string;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  email: string;
  mobile_number: string;
  date_of_joining: string;
  employment_type: string;
  position_title: string;
  education_level: string;
  prior_experience_years: string;
  grade: string;
  step: string;
  civil_service_card_id: string;
  sso_number: string;
  ministry_name: string;
  department_name: string;
  service_province: string;
  bank_name: string;
  bank_branch: string;
  bank_account_no: string;
  has_spouse: string;
  eligible_children: string;
  position_level: string;
  profession_category: string;
  _errors: Record<string, string>;
  _status: RowStatus;
};

function newRowId() {
  return `r-${crypto.randomUUID()}`;
}

function blankRow(): GridRow {
  return {
    rowId: newRowId(),
    employee_code: "",
    title: "",
    first_name: "",
    last_name: "",
    gender: "",
    date_of_birth: "",
    email: "",
    mobile_number: "",
    date_of_joining: "",
    employment_type: "",
    position_title: "",
    education_level: "",
    prior_experience_years: "",
    grade: "",
    step: "",
    civil_service_card_id: "",
    sso_number: "",
    ministry_name: "",
    department_name: "",
    service_province: "",
    bank_name: "",
    bank_branch: "",
    bank_account_no: "",
    has_spouse: "",
    eligible_children: "",
    position_level: "",
    profession_category: "",
    _errors: {},
    _status: "empty",
  };
}

function rowHasData(r: GridRow): boolean {
  return [r.first_name, r.last_name, r.email].some((x) => String(x).trim() !== "");
}

function computeRowStatus(r: GridRow): RowStatus {
  if (!rowHasData(r)) return "empty";
  if (Object.keys(r._errors).length > 0) return "error";
  return "valid";
}

const FIELD_HINTS: Record<string, string> = {
  email: "Format: firstname.lastname@gov.la",
  date_of_birth: "Format: YYYY-MM-DD (e.g. 1990-01-25)",
  date_of_joining: "Format: YYYY-MM-DD (e.g. 2020-06-15)",
  mobile_number: "Digits only, e.g. 2012345678",
  sso_number: "Format: SSO followed by 7 digits",
  civil_service_card_id: "Must be unique",
  bank_account_no: "Must be unique",
};

function flattenBatchErrors(results: BatchResultRow[]) {
  const rows: { key: string; row: number; field: string; message: string; hint: string }[] = [];
  for (const r of results) {
    if (r.status !== "error") continue;
    for (const err of r.errors) {
      rows.push({
        key: `${r.row}-${err.field}-${rows.length}`,
        row: r.row + 1,
        field: err.field,
        message: err.message,
        hint: FIELD_HINTS[err.field] ?? "—",
      });
    }
  }
  return rows;
}

function StatusCellRenderer(props: ICellRendererParams<GridRow>) {
  const r = props.data;
  if (!r) return null;
  const st = r._status;
  if (st === "empty") {
    return (
      <span style={{ color: "#999" }}>
        <MinusCircleOutlined /> ○
      </span>
    );
  }
  if (st === "error") {
    const n = Object.keys(r._errors).length;
    return (
      <span style={{ color: "#ff4d4f" }}>
        <CloseCircleOutlined /> ✗ ({n})
      </span>
    );
  }
  return (
    <span style={{ color: "#52c41a" }}>
      <CheckCircleOutlined /> ✓
    </span>
  );
}

export function GridEntryPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: ministryData } = useMinistries();
  const { data: provinceData } = useProvinces();
  const { data: deptData } = useDepartments();
  const departmentOptions = Array.isArray(deptData) ? deptData : [];
  const { data: bankData } = useBanks();
  const { data: allBranchData } = useAllBranches();
  const bankOptions = bankData ?? [];
  const rowBankMap = useRef<Record<string, string>>({});
  const gridRef = useRef<AgGridReact<GridRow>>(null);
  const [rowData, setRowData] = useState<GridRow[]>(() => Array.from({ length: 10 }, () => blankRow()));
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchCreateResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastBatchSuccessRef = useRef<{ ids: Set<string>; count: number } | null>(null);

  const dupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshStatuses = useCallback((rows: GridRow[]) => {
    return rows.map((r) => {
      const _status = computeRowStatus(r);
      return { ...r, _status };
    });
  }, []);

  const promptClearImportedRows = useCallback(
    (ids: Set<string>, count: number) => {
      if (count === 0) return;
      Modal.confirm({
        title: `Clear ${count} successfully imported rows?`,
        okText: "Clear",
        cancelText: "Keep",
        onOk: () => {
          setRowData((prev) => {
            const next = prev.filter((r) => !ids.has(r.rowId));
            const pad = [...next];
            while (pad.length < 10) pad.push(blankRow());
            return refreshStatuses(pad);
          });
        },
      });
    },
    [refreshStatuses],
  );

  const handleCloseErrorModal = useCallback(() => {
    setErrorModalOpen(false);
    const p = lastBatchSuccessRef.current;
    lastBatchSuccessRef.current = null;
    if (p) {
      promptClearImportedRows(p.ids, p.count);
    }
  }, [promptClearImportedRows]);

  const onCellValueChanged = useCallback(
    (e: CellValueChangedEvent<GridRow>) => {
      const field = e.colDef.field;
      if (!field || field.startsWith("_")) return;

      if (field === "mobile_number") {
        const cleaned = String(e.newValue ?? "").replace(/\D/g, "");
        if (cleaned !== String(e.newValue ?? "")) {
          e.node.setDataValue("mobile_number", cleaned);
          setRowData((prev) => {
            const next = prev.map((r) =>
              r.rowId === e.data?.rowId ? { ...r, mobile_number: cleaned } : r,
            );
            return refreshStatuses(next);
          });
          return;
        }
      }

      const dupFields = new Set(["email", "civil_service_card_id", "bank_account_no", "sso_number"]);
      const rowId = e.data?.rowId;

      setRowData((prev) => {
        const next = prev.map((r) => {
          if (r.rowId !== rowId) return r;
          let updated: GridRow = { ...r, [field]: String(e.newValue ?? "") };
          if (field === "bank_name") {
            if (rowId) rowBankMap.current[rowId] = String(e.newValue ?? "");
            updated = { ...updated, bank_branch: "" };
          }
          return updated;
        });
        return refreshStatuses(next);
      });

      if (field === "bank_name" && rowId) {
        e.node.setDataValue("bank_branch", "");
      }

      if (!dupFields.has(field)) return;

      const val = String(e.newValue ?? "").trim();
      if (dupTimer.current) clearTimeout(dupTimer.current);

      if (!val) {
        setRowData((prev) => {
          const next = prev.map((r) => {
            if (r.rowId !== rowId) return r;
            const er = { ...r._errors };
            delete er[field];
            return { ...r, _errors: er };
          });
          return refreshStatuses(next);
        });
        return;
      }

      dupTimer.current = setTimeout(() => {
        void (async () => {
          try {
            const { data } = await apiClient.get<
              ApiEnvelope<{ is_duplicate: boolean; existing_code: string | null }>
            >("/api/v1/employees/check-duplicate", { params: { field, value: val } });
            if (!data.success || data.data === null) return;
            setRowData((prev) => {
              const merged = prev.map((r) => {
                if (r.rowId !== rowId) return r;
                const er = { ...r._errors };
                if (data.data!.is_duplicate) {
                  er[field] = t("gridEntry.duplicateField", { code: data.data!.existing_code ?? "?" });
                } else {
                  delete er[field];
                }
                return { ...r, _errors: er };
              });
              return refreshStatuses(merged);
            });
          } catch {
            /* ignore */
          }
        })();
      }, 400);
    },
    [refreshStatuses, t],
  );

  const columnDefs = useMemo<ColDef<GridRow>[]>(
    () => [
      {
        field: "title",
        headerName: "Title",
        width: 90,
        editable: true,
        pinned: "left",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."] },
      },
      { field: "first_name", headerName: "First Name", width: 140, editable: true, pinned: "left" },
      { field: "last_name", headerName: "Last Name", width: 140, editable: true, pinned: "left" },
      {
        field: "gender",
        headerName: "Gender",
        width: 100,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Male", "Female", "Other"] },
      },
      {
        field: "date_of_birth",
        headerName: "Date of Birth (YYYY-MM-DD)",
        width: 160,
        editable: true,
        cellEditor: "agTextCellEditor",
        cellEditorParams: { placeholder: "e.g. 1990-01-25" },
        valueFormatter: (params) => {
          if (!params.value || String(params.value).length < 8) return params.value || "";
          try {
            return dayjs(params.value).format("DD-MMM-YYYY");
          } catch {
            return String(params.value);
          }
        },
      },
      { field: "email", headerName: "Email", width: 220, editable: true },
      { field: "mobile_number", headerName: "Mobile", width: 140, editable: true },
      {
        field: "date_of_joining",
        headerName: "Date of Joining (YYYY-MM-DD)",
        width: 160,
        editable: true,
        cellEditor: "agTextCellEditor",
        cellEditorParams: { placeholder: "e.g. 1990-01-25" },
        valueFormatter: (params) => {
          if (!params.value || String(params.value).length < 8) return params.value || "";
          try {
            return dayjs(params.value).format("DD-MMM-YYYY");
          } catch {
            return String(params.value);
          }
        },
      },
      {
        field: "employment_type",
        headerName: "Emp Type",
        width: 130,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Permanent", "Probationary", "Contract", "Intern"] },
      },
      {
        field: "position_title",
        headerName: "Position",
        width: 180,
        editable: true,
        cellEditor: "agTextCellEditor",
        cellEditorParams: { placeholder: "Enter position title" },
        tooltipValueGetter: () => "Enter position title",
      },
      {
        field: "education_level",
        headerName: "Education",
        width: 160,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: [
            "Below Secondary",
            "Secondary School (Grade 12)",
            "Diploma (2 years)",
            "Bachelor's Degree",
            "Master's Degree",
            "Doctorate (PhD)",
          ],
        },
      },
      { field: "prior_experience_years", headerName: "Prior Exp (Yrs)", width: 120, editable: true },
      { field: "civil_service_card_id", headerName: "CSC ID", width: 120, editable: true },
      { field: "sso_number", headerName: "SSO Number", width: 130, editable: true },
      {
        field: "ministry_name",
        headerName: "Ministry",
        width: 260,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ministryData ?? [] },
      },
      {
        field: "department_name",
        headerName: "Department",
        width: 220,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: departmentOptions },
      },
      {
        field: "service_province",
        headerName: "Province",
        width: 160,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: provinceData ?? [] },
      },
      {
        field: "bank_name",
        headerName: "Bank Name",
        width: 200,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: bankOptions },
      },
      {
        field: "bank_branch",
        headerName: "Bank Branch",
        width: 200,
        editable: true,
        cellEditorSelector: (params) => {
          const bankName = params.data?.bank_name || "";
          const list = allBranchData ?? [];
          const filtered = list
            .filter((b: BranchOption) => b.bank_name === bankName)
            .map((b: BranchOption) => b.branch_name);
          return {
            component: "agSelectCellEditor",
            params: {
              values: filtered.length > 0 ? filtered : ["Select bank first"],
            },
          };
        },
      },
      { field: "bank_account_no", headerName: "Account No", width: 140, editable: true },
      {
        field: "has_spouse",
        headerName: "Has Spouse",
        width: 110,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["true", "false"] },
      },
      { field: "eligible_children", headerName: "Children (max 3)", width: 130, editable: true },
      {
        field: "_status",
        headerName: "Status",
        width: 100,
        editable: false,
        pinned: "right",
        cellRenderer: StatusCellRenderer,
      },
    ],
    [ministryData, provinceData, departmentOptions, bankOptions, allBranchData],
  );

  const stats = useMemo(() => {
    let valid = 0;
    let errors = 0;
    for (const r of rowData) {
      if (r._status === "valid") valid += 1;
      if (r._status === "error") errors += 1;
    }
    return { total: rowData.length, valid, errors };
  }, [rowData]);

  const buildPayload = useCallback((r: GridRow): Record<string, unknown> => {
    const toBool = (s: string) => s === "true";
    const toInt = (s: string, d: number) => {
      const n = parseInt(String(s), 10);
      return Number.isFinite(n) ? n : d;
    };
    return {
      title: r.title,
      first_name: r.first_name.trim(),
      last_name: r.last_name.trim(),
      gender: r.gender,
      date_of_birth: r.date_of_birth ? dayjs(r.date_of_birth).format("YYYY-MM-DD") : "",
      email: r.email.trim(),
      mobile_number: r.mobile_number.trim() || null,
      date_of_joining: r.date_of_joining ? dayjs(r.date_of_joining).format("YYYY-MM-DD") : "",
      employment_type: r.employment_type,
      position_title: r.position_title.trim(),
      education_level: r.education_level,
      prior_experience_years: toInt(r.prior_experience_years, 0),
      grade: toInt(r.grade, 1),
      step: toInt(r.step, 1),
      civil_service_card_id: r.civil_service_card_id.trim(),
      sso_number: r.sso_number.trim() || null,
      ministry_name: r.ministry_name.trim(),
      department_name: r.department_name.trim(),
      division_name: null,
      service_country: "Lao PDR",
      service_province: r.service_province.trim(),
      service_district: null,
      profession_category: r.profession_category.trim() || "General",
      is_remote_area: false,
      is_foreign_posting: false,
      is_hazardous_area: false,
      house_no: null,
      street: null,
      area_baan: null,
      province_of_residence: null,
      pin_code: null,
      residence_country: null,
      bank_name: r.bank_name.trim(),
      bank_branch: r.bank_branch.trim(),
      bank_branch_code: null,
      bank_account_no: r.bank_account_no.trim(),
      swift_code: null,
      has_spouse: toBool(r.has_spouse),
      eligible_children: Math.min(3, Math.max(0, toInt(r.eligible_children, 0))),
      position_level: r.position_level.trim() || "General",
      is_na_member: false,
      field_allowance_type: "None",
      is_active: true,
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    const toSend = rowData.filter((r) => r._status === "valid");
    if (toSend.length === 0) return;
    setSubmitting(true);
    const submittedRowIds = toSend.map((r) => r.rowId);
    try {
      const employees = toSend.map((r) => buildPayload(r));
      console.log("grid batch payload", employees);
      const res = await submitEmployeeBatch(employees);
      if (!res.success || res.data === null) {
        throw new Error("batch");
      }
      const data = res.data;
      setBatchResult(data);

      setRowData((prev) => {
        const errByRowId = new Map<string, Record<string, string>>();
        for (const br of data.results) {
          if (br.status !== "error") continue;
          const rowId = submittedRowIds[br.row];
          const acc: Record<string, string> = {};
          for (const e of br.errors) {
            acc[e.field] = acc[e.field] ? `${acc[e.field]}; ${e.message}` : e.message;
          }
          errByRowId.set(rowId, acc);
        }
        return refreshStatuses(
          prev.map((r) => {
            const be = errByRowId.get(r.rowId);
            if (!be) return r;
            return { ...r, _errors: be };
          }),
        );
      });

      const successRowIds = new Set<string>();
      const successCodes: string[] = [];
      for (const r of data.results) {
        if (r.status === "success") {
          successRowIds.add(submittedRowIds[r.row]);
          successCodes.push(r.employee_code);
        }
      }

      lastBatchSuccessRef.current = { ids: successRowIds, count: data.imported };

      if (data.imported > 0) {
        message.success(
          `${data.imported} employee(s) imported successfully! Employee codes: ${successCodes.join(", ")}`,
        );
      }

      if (data.skipped > 0) {
        setErrorModalOpen(true);
      } else {
        promptClearImportedRows(successRowIds, data.imported);
        lastBatchSuccessRef.current = null;
      }
    } catch {
      Modal.error({ title: t("login.error.generic") });
    } finally {
      setSubmitting(false);
    }
  }, [buildPayload, promptClearImportedRows, refreshStatuses, rowData, t]);

  const canUse = user?.role === ROLES.EMPLOYEE || user?.role === ROLES.MANAGER || user?.role === ROLES.ADMIN;

  if (!canUse) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Text type="danger">Forbidden</Typography.Text>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, width: "100%", maxWidth: "100%" }}>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        {t("gridEntry.title")}
      </Typography.Title>

      <Space wrap style={{ marginBottom: 12 }}>
        <Button
          onClick={() => {
            setRowData((prev) => [...prev, blankRow()]);
            setTimeout(() => gridRef.current?.api?.sizeColumnsToFit(), 100);
          }}
        >
          {t("gridEntry.addRow")}
        </Button>
        <Button
          danger
          onClick={() => {
            Modal.confirm({
              title: t("gridEntry.clearConfirm"),
              onOk: () => setRowData(Array.from({ length: 10 }, () => blankRow())),
            });
          }}
        >
          {t("gridEntry.clearAll")}
        </Button>
        <Typography.Text type="secondary">
          {t("gridEntry.rowCounter", {
            total: stats.total,
            valid: stats.valid,
            errors: stats.errors,
          })}
        </Typography.Text>
        <Button type="primary" disabled={stats.valid === 0} loading={submitting} onClick={() => void handleSubmit()}>
          {t("gridEntry.submitValid")}
        </Button>
      </Space>

      <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
        {t("gridEntry.tip_scroll")}
      </Typography.Text>

      {batchResult && batchResult.skipped > 0 && !errorModalOpen ? (
        <Collapse defaultActiveKey={["skipped"]} style={{ marginBottom: 12 }}>
          <Collapse.Panel header={t("gridEntry.skipped_rows", { count: batchResult.skipped })} key="skipped">
            <Table
              size="small"
              pagination={false}
              scroll={{ x: true }}
              dataSource={flattenBatchErrors(batchResult.results)}
              columns={[
                { title: t("gridEntry.col_row"), dataIndex: "row", key: "row", width: 72 },
                { title: t("gridEntry.col_field"), dataIndex: "field", key: "field", width: 180 },
                { title: t("gridEntry.col_error"), dataIndex: "message", key: "message" },
                { title: t("gridEntry.col_hint"), dataIndex: "hint", key: "hint", width: 260 },
              ]}
            />
          </Collapse.Panel>
        </Collapse>
      ) : null}

      <div
        className="ag-theme-alpine"
        style={{
          height: "calc(100vh - 320px)",
          width: "100%",
          minHeight: "400px",
          border: "1px solid #d9d9d9",
          borderRadius: 4,
        }}
      >
        <AgGridReact<GridRow>
          theme="legacy"
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            resizable: true,
            sortable: false,
            editable: true,
            cellStyle: { borderRight: "1px solid #f0f0f0", padding: "0 8px" },
          }}
          rowStyle={{ borderBottom: "1px solid #f0f0f0" }}
          onCellValueChanged={onCellValueChanged}
          ref={gridRef}
          domLayout="normal"
          suppressRowClickSelection={true}
          getRowId={(p) => p.data.rowId}
          rowHeight={40}
          headerHeight={44}
        />
      </div>

      <Modal
        open={errorModalOpen}
        onCancel={handleCloseErrorModal}
        footer={[
          <Button key="close" type="primary" onClick={handleCloseErrorModal}>
            {t("gridEntry.close_fix")}
          </Button>,
        ]}
        title={t("gridEntry.importSkipped", { count: batchResult?.skipped ?? 0 })}
        width={900}
      >
        {batchResult && batchResult.skipped > 0 ? (
          <Table
            size="small"
            pagination={false}
            scroll={{ x: true }}
            dataSource={flattenBatchErrors(batchResult.results)}
            columns={[
              { title: t("gridEntry.col_row"), dataIndex: "row", key: "row", width: 72 },
              { title: t("gridEntry.col_field"), dataIndex: "field", key: "field", width: 180 },
              { title: t("gridEntry.col_error"), dataIndex: "message", key: "message" },
              { title: t("gridEntry.col_hint"), dataIndex: "hint", key: "hint", width: 260 },
            ]}
          />
        ) : null}
      </Modal>
    </div>
  );
}
