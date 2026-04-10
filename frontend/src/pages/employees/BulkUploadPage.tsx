/** Screen: `BulkUploadPage` — page-level UI and mutations. */
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Fragment, useCallback, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import {
  commitUpload,
  downloadTemplate,
  parseUpload,
  type CommitResult,
  type ParseResult,
  type RowResult,
} from "@/api/uploads";
import type { ApiEnvelope } from "@/types/auth";

function getApiErrorCode(err: unknown): string | undefined {
  if (
    isAxiosError(err) &&
    err.response?.data &&
    typeof err.response.data === "object" &&
    err.response.data !== null &&
    "error" in err.response.data
  ) {
    const e = (err.response.data as ApiEnvelope<null>).error;
    return e?.code;
  }
  if (err && typeof err === "object" && "response" in err) {
    const r = err as { response?: { data?: ApiEnvelope<null> } };
    return r.response?.data?.error?.code;
  }
  return undefined;
}

const CARD: CSSProperties = {
  maxWidth: 600,
  margin: "0 auto",
  background: "#FFFFFF",
  borderRadius: 12,
  padding: "2rem",
  border: "0.5px solid #DDE1EA",
};

const NAVY = "#1B3A6B";
const GOLD = "#C9A84C";
const PAGE_BG = "#F7F8FA";

function StepIndicator({
  step,
  t,
}: {
  step: number;
  t: (k: string) => string;
}) {
  const circles = [
    { n: 0, label: t("upload.step_upload") },
    { n: 1, label: t("upload.step_validate") },
    { n: 2, label: t("upload.step_done") },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        marginBottom: 28,
        maxWidth: 560,
        marginLeft: "auto",
        marginRight: "auto",
        gap: 0,
      }}
    >
      {circles.map((c, idx) => {
        const done = step > c.n;
        const active = step === c.n;
        const lineDone = step > c.n;
        return (
          <Fragment key={c.n}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 88 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  fontWeight: 600,
                  color: done || active ? "#FFFFFF" : "#7A8599",
                  background: done ? GOLD : active ? NAVY : "#F7F8FA",
                  border: active || done ? "none" : "0.5px solid #DDE1EA",
                }}
              >
                {done ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  c.n + 1
                )}
              </div>
              <span
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  color: active ? NAVY : "#7A8599",
                  textAlign: "center",
                }}
              >
                {c.label}
              </span>
            </div>
            {idx < 2 && (
              <div
                style={{
                  width: 48,
                  height: 1,
                  marginTop: 20,
                  background: lineDone ? GOLD : "#DDE1EA",
                  flexShrink: 0,
                }}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function StatusPill({ status, t }: { status: RowResult["status"]; t: (k: string) => string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    OK: { bg: "#E8F5E9", color: "#2E7D32", label: t("upload.status_valid") },
    WARN: { bg: "#FFF8E1", color: "#F57F17", label: t("upload.status_warning") },
    ERROR: { bg: "#FFEBEE", color: "#C62828", label: t("upload.status_error") },
  };
  const s = map[status] ?? map.OK;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}

function issuesText(row: RowResult): string {
  const parts = [...row.errors, ...row.warnings];
  if (parts.length === 0) return "—";
  if (parts.length <= 2) return parts.join(" · ");
  const more = parts.length - 2;
  return `${parts[0]} · ${parts[1]} · + ${more} more`;
}

export function BulkUploadPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [commitErr, setCommitErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseMutation = useMutation({
    mutationFn: async (f: File) => {
      const res = await parseUpload(f);
      if (!res.success) {
        const e = new Error(res.error?.message ?? "parse failed") as Error & {
          response?: { data: ApiEnvelope<null> };
        };
        e.response = { data: res as unknown as ApiEnvelope<null> };
        throw e;
      }
      return res;
    },
    onSuccess: (res) => {
      if (res.data) {
        setParseResult(res.data);
        setStep(1);
      }
    },
  });

  const commitMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await commitUpload(sessionId);
      if (!res.success) {
        const e = new Error(res.error?.message ?? "commit failed") as Error & {
          response?: { data: ApiEnvelope<null> };
        };
        e.response = { data: res as unknown as ApiEnvelope<null> };
        throw e;
      }
      return res;
    },
    onSuccess: (res) => {
      setCommitErr(null);
      if (res.data) {
        setCommitResult(res.data);
        setStep(2);
      }
    },
    onError: (err) => {
      const code = getApiErrorCode(err);
      setCommitErr(
        code === "ERR_UPLOAD_SESSION_EXPIRED"
          ? t("upload.error.session_expired", { defaultValue: "Session expired. Please validate again." })
          : t("upload.error.generic"),
      );
    },
  });

  const resetAll = useCallback(() => {
    setStep(0);
    setFile(null);
    setParseResult(null);
    setCommitResult(null);
    setCommitErr(null);
    parseMutation.reset();
    commitMutation.reset();
    if (inputRef.current) inputRef.current.value = "";
  }, [parseMutation, commitMutation]);

  const parseErrCode = parseMutation.isError ? getApiErrorCode(parseMutation.error) : undefined;
  const parseErrMsg =
    parseErrCode === "ERR_UPLOAD_MACRO_DETECTED"
      ? t("upload.error.macro")
      : parseErrCode === "ERR_UPLOAD_INVALID_FORMAT"
        ? t("upload.error.format")
        : parseErrCode === "ERR_UPLOAD_TOO_LARGE"
          ? t("upload.error.too_large")
          : parseMutation.isError
            ? t("upload.error.generic")
            : "";

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f && f.name.toLowerCase().endsWith(".xlsx")) setFile(f);
    },
    [],
  );

  const columns: ColumnsType<RowResult> = [
    {
      title: t("upload.col_row"),
      dataIndex: "row_number",
      key: "row_number",
      width: 70,
    },
    {
      title: t("upload.col_code"),
      dataIndex: "employee_code",
      key: "employee_code",
      width: 110,
      render: (v: string | null) => (v ? v : "—"),
    },
    {
      title: t("upload.col_status"),
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (s: RowResult["status"]) => <StatusPill status={s} t={t} />,
    },
    {
      title: t("upload.col_issues"),
      key: "issues",
      render: (_, row) => (
        <span style={{ fontSize: 13, color: "#3D4F66" }}>{issuesText(row)}</span>
      ),
    },
  ];

  return (
    <div style={{ background: PAGE_BG, minHeight: "100%", padding: "24px 16px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 16, fontSize: 13 }}>
          <Link to="/employees" style={{ color: NAVY }}>
            {t("nav.employees")}
          </Link>
          <span style={{ color: "#9BA5B7", margin: "0 8px" }}>/</span>
          <span style={{ color: "#7A8599" }}>{t("upload.title")}</span>
        </div>
        <Typography.Title level={4} style={{ margin: "0 0 20px", color: NAVY, textAlign: "center" }}>
          {t("upload.title")}
        </Typography.Title>

        <StepIndicator step={step} t={t} />

        {step === 0 && (
          <div style={CARD}>
            <button
              type="button"
              onClick={() => void downloadTemplate()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontSize: 13,
                color: NAVY,
                textDecoration: "underline",
                marginBottom: 20,
              }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 4v12M8 12l4 4 4-4M4 20h16"
                  stroke={NAVY}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t("upload.template_hint")}
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />

            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              style={{
                border: file ? `1px solid ${NAVY}` : `2px dashed ${dragOver ? NAVY : "#DDE1EA"}`,
                borderRadius: 12,
                padding: "40px 24px",
                textAlign: "center",
                background: dragOver ? "#EEF2F9" : "#FAFBFC",
                cursor: "pointer",
                transition: "border-color 0.2s, background 0.2s",
              }}
            >
              {!file ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <svg width={40} height={40} viewBox="0 0 64 64" fill="none" aria-hidden>
                      <path
                        d="M32 8C22 8 14 16 14 26c0 8 5 15 12 18v6H18v8h28v-8H38v-6c7-3 12-10 12-18 0-10-8-18-18-18z"
                        fill="#9BA5B7"
                      />
                      <path d="M28 36l8-8 8 8" stroke="#9BA5B7" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 14, color: "#3D4F66", marginBottom: 8 }}>{t("upload.drop_hint")}</div>
                  <div style={{ fontSize: 12, color: "#9BA5B7" }}>{t("upload.size_hint")}</div>
                </>
              ) : (
                <div style={{ textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                        stroke={NAVY}
                        strokeWidth="1.5"
                        fill="none"
                      />
                    </svg>
                    <span style={{ fontSize: 14, fontWeight: 500, color: NAVY }}>{file.name}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#7A8599", marginBottom: 8 }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#E24B4A",
                    }}
                  >
                    {t("upload.remove_file")}
                  </button>
                </div>
              )}
            </div>

            {parseMutation.isError && (
              <div
                style={{
                  background: "#FFF0F0",
                  borderLeft: "3px solid #E24B4A",
                  borderRadius: 6,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#A32D2D",
                  marginTop: 16,
                }}
              >
                {parseErrMsg}
              </div>
            )}

            <button
              type="button"
              disabled={!file || parseMutation.isPending}
              onClick={() => file && parseMutation.mutate(file)}
              style={{
                width: "100%",
                marginTop: 20,
                padding: "10px",
                background: !file || parseMutation.isPending ? "#B8C4D4" : NAVY,
                color: "#FFFFFF",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                border: "none",
                cursor: !file || parseMutation.isPending ? "not-allowed" : "pointer",
              }}
            >
              {parseMutation.isPending ? "…" : t("upload.parse_btn")}
            </button>
          </div>
        )}

        {step === 1 && parseResult && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {[
                { label: t("upload.stat_total"), value: parseResult.total_rows, bg: "#F7F8FA", color: "#3D4F66" },
                { label: t("upload.stat_valid"), value: parseResult.valid_rows, bg: "#E8F5E9", color: "#2E7D32" },
                {
                  label: t("upload.stat_warnings"),
                  value: parseResult.warning_rows,
                  bg: "#FFF8E1",
                  color: "#F57F17",
                },
                { label: t("upload.stat_errors"), value: parseResult.error_rows, bg: "#FFEBEE", color: "#C62828" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    borderRadius: 8,
                    padding: "12px 16px",
                    background: s.bg,
                    border: "0.5px solid #DDE1EA",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#7A8599", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 500, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 12,
                border: "0.5px solid #DDE1EA",
                padding: 16,
                marginBottom: 16,
              }}
            >
              <Table<RowResult>
                size="small"
                rowKey="row_number"
                pagination={false}
                scroll={{ x: true, y: 420 }}
                columns={columns}
                dataSource={parseResult.all_rows}
                rowClassName={(record) =>
                  record.status === "ERROR" ? "upload-row-err" : record.status === "WARN" ? "upload-row-warn" : ""
                }
              />
              <style>{`
                .upload-row-err td { background: #FFF5F5 !important; }
                .upload-row-warn td { background: #FFFDE7 !important; }
              `}</style>
            </div>

            {!parseResult.can_commit && (
              <div
                style={{
                  background: "#FFF0F0",
                  borderLeft: "3px solid #E24B4A",
                  borderRadius: 6,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#A32D2D",
                  marginBottom: 16,
                }}
              >
                {t("upload.has_errors_msg", { count: parseResult.error_rows })}
              </div>
            )}

            {parseResult.can_commit && (
              <div
                style={{
                  background: "#F1F8E9",
                  borderLeft: "3px solid #43A047",
                  borderRadius: 6,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#2E7D32",
                  marginBottom: 16,
                }}
              >
                {t("upload.all_valid_msg")}
              </div>
            )}

            {commitErr && (
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
                {commitErr}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={resetAll}
                disabled={commitMutation.isPending}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "0.5px solid #DDE1EA",
                  background: "#FAFBFC",
                  color: "#7A8599",
                  cursor: commitMutation.isPending ? "not-allowed" : "pointer",
                  fontSize: 14,
                }}
              >
                {t("upload.reupload_btn")}
              </button>
              {parseResult.can_commit && (
                <button
                  type="button"
                  disabled={commitMutation.isPending}
                  onClick={() => commitMutation.mutate(parseResult.session_id)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: commitMutation.isPending ? "#B8C4D4" : NAVY,
                    color: "#FFFFFF",
                    cursor: commitMutation.isPending ? "not-allowed" : "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {commitMutation.isPending ? "…" : t("upload.commit_btn")}
                </button>
              )}
            </div>
          </div>
        )}

        {step === 2 && commitResult && (
          <div style={CARD}>
            <div style={{ textAlign: "center" }}>
              {commitResult.committed > 0 ? (
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: GOLD,
                    margin: "0 auto 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width={32} height={32} viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              ) : (
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "#FFEBEE",
                    margin: "0 auto 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#C62828",
                    fontSize: 28,
                    fontWeight: 700,
                  }}
                >
                  ×
                </div>
              )}
              <Typography.Title level={4} style={{ color: NAVY, marginBottom: 16 }}>
                {t("upload.done_title")}
              </Typography.Title>
              <div style={{ fontSize: 15, fontWeight: 500, color: NAVY, marginBottom: 8 }}>
                {t("upload.imported")}: {commitResult.committed}
              </div>
              <div style={{ fontSize: 14, color: "#7A8599", marginBottom: 4 }}>
                {t("upload.skipped_dup")}: {commitResult.skipped_duplicates}
              </div>
              <div style={{ fontSize: 14, color: "#7A8599", marginBottom: 24 }}>
                {t("upload.skipped_err")}: {commitResult.skipped_errors}
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={resetAll}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "0.5px solid #DDE1EA",
                    background: "#FAFBFC",
                    color: "#7A8599",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  {t("upload.another_btn")}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/employees")}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: NAVY,
                    color: "#FFFFFF",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {t("upload.view_employees_btn")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
