/** Screen: `PayslipPage` — page-level UI and mutations. */
import { Button, Skeleton, Typography } from "antd";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import { fetchEmployee } from "@/api/employees";
import { fetchPayroll } from "@/api/payroll";
import { useQuery } from "@tanstack/react-query";

const NAVY = "#1B3A6B";

export function PayslipPage() {
  const { t } = useTranslation();
  const { code, month } = useParams<{ code: string; month: string }>();

  const payrollQ = useQuery({
    queryKey: ["payroll", "payslip", month, code],
    enabled: Boolean(month && code),
    queryFn: async () => {
      if (!month || !code) throw new Error("params");
      const res = await fetchPayroll({ month, limit: 500, page: 1 });
      if (!res.success || res.data === null) throw new Error("payroll");
      const row = res.data.find((r) => r.employee_code === code);
      if (!row) throw new Error("notfound");
      return row;
    },
  });

  const empQ = useQuery({
    queryKey: ["employees", code],
    enabled: Boolean(code),
    queryFn: async () => {
      if (!code) throw new Error("code");
      const res = await fetchEmployee(code);
      if (!res.success || !res.data) throw new Error("emp");
      return res.data;
    },
  });

  const row = payrollQ.data;
  const emp = empQ.data;

  const earningsRows = row
    ? [
        { key: "basic", label: t("payslip.allowance_labels.basic"), amount: row.basic_salary },
        { key: "position", label: t("payslip.allowance_labels.position"), amount: row.allowance_position },
        { key: "technical", label: t("payslip.allowance_labels.technical"), amount: row.allowance_technical },
        { key: "remote", label: t("payslip.allowance_labels.remote"), amount: row.allowance_remote },
        { key: "hazardous", label: t("payslip.allowance_labels.hazardous"), amount: row.allowance_hazardous },
        { key: "foreign", label: t("payslip.allowance_labels.foreign"), amount: row.allowance_foreign },
        { key: "spouse", label: t("payslip.allowance_labels.spouse"), amount: row.allowance_spouse },
        { key: "children", label: t("payslip.allowance_labels.children"), amount: row.allowance_children },
        { key: "teaching", label: t("payslip.allowance_labels.teaching"), amount: row.allowance_teaching },
        { key: "medical", label: t("payslip.allowance_labels.medical"), amount: row.allowance_medical },
        { key: "na", label: t("payslip.allowance_labels.na"), amount: row.allowance_na },
        { key: "housing", label: t("payslip.allowance_labels.housing"), amount: row.allowance_housing },
        { key: "transport", label: t("payslip.allowance_labels.transport"), amount: row.allowance_transport },
        { key: "free_1", label: t("payslip.allowance_labels.free_1"), amount: row.free_allowance_1 },
        { key: "free_2", label: t("payslip.allowance_labels.free_2"), amount: row.free_allowance_2 },
        { key: "free_3", label: t("payslip.allowance_labels.free_3"), amount: row.free_allowance_3 },
      ].filter((x) => Number(x.amount) > 0)
    : [];

  const deductionRows = row
    ? [
        { key: "sso", label: t("payslip.allowance_labels.sso"), amount: row.employee_sso },
        { key: "pit", label: t("payslip.allowance_labels.pit"), amount: row.pit_amount },
        { key: "d1", label: t("payslip.allowance_labels.ded_1"), amount: row.free_deduction_1 },
        { key: "d2", label: t("payslip.allowance_labels.ded_2"), amount: row.free_deduction_2 },
      ].filter((x) => Number(x.amount) > 0)
    : [];

  const totalDed = row
    ? Number(row.employee_sso) + Number(row.pit_amount) + Number(row.free_deduction_1) + Number(row.free_deduction_2)
    : 0;

  const printToday = dayjs().format("YYYY-MM-DD");

  if (payrollQ.isLoading || empQ.isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active />
      </div>
    );
  }

  if (payrollQ.isError || !row) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Text type="danger">{t("payslip.not_found")}</Typography.Text>
      </div>
    );
  }

  return (
    <div style={{ background: "#F7F8FA", minHeight: "100%", padding: "1rem" }}>
      <div className="payslip-no-print" style={{ maxWidth: 700, margin: "0 auto 12px", textAlign: "right" }}>
        <Button type="primary" style={{ background: NAVY }} onClick={() => window.print()}>
          {t("payslip.print_btn")}
        </Button>
      </div>

      <div
        style={{
          maxWidth: 700,
          margin: "0 auto",
          background: "#FFFFFF",
          borderRadius: 12,
          border: "0.5px solid #DDE1EA",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: NAVY,
            color: "#FFFFFF",
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography.Text style={{ color: "#FFFFFF", fontSize: 13 }}>{t("payslip.header_org")}</Typography.Text>
          <Typography.Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: 600 }}>
            {t("payslip.header_title")}
          </Typography.Text>
        </div>

        <div style={{ padding: "12px 20px", borderBottom: "0.5px solid #DDE1EA" }}>
          <Typography.Text type="secondary">
            {t("payroll.title")}: {dayjs(row.payroll_month + "-01").format("MMMM YYYY")}
          </Typography.Text>
          <br />
          <Typography.Text type="secondary">
            {t("payslip.label_employee")}: {row.employee_code}
          </Typography.Text>
        </div>

        {emp && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              padding: "16px 20px",
              fontSize: 13,
            }}
          >
            <div>
              <div style={{ color: "#7A8599", marginBottom: 4 }}>{t("payslip.label_name")}</div>
              <div>
                {emp.title} {emp.first_name} {emp.last_name}
              </div>
              <div style={{ color: "#7A8599", marginTop: 8, marginBottom: 4 }}>{t("payslip.label_position")}</div>
              <div>{emp.position_title}</div>
              <div style={{ color: "#7A8599", marginTop: 8, marginBottom: 4 }}>{t("payslip.label_ministry")}</div>
              <div>{emp.ministry_name}</div>
              <div style={{ color: "#7A8599", marginTop: 8, marginBottom: 4 }}>{t("payslip.label_department")}</div>
              <div>{emp.department_name}</div>
            </div>
            <div>
              <div style={{ color: "#7A8599", marginBottom: 4 }}>{t("payslip.label_grade_step")}</div>
              <div>
                G{emp.grade}/S{emp.step}
              </div>
              <div style={{ color: "#7A8599", marginTop: 8, marginBottom: 4 }}>{t("payslip.label_employment")}</div>
              <div>{emp.employment_type}</div>
              <div style={{ color: "#7A8599", marginTop: 8, marginBottom: 4 }}>{t("payslip.label_civil_service")}</div>
              <div>{emp.civil_service_card_id}</div>
              <div style={{ color: "#7A8599", marginTop: 8, marginBottom: 4 }}>{t("payslip.label_join_date")}</div>
              <div>{emp.date_of_joining}</div>
            </div>
          </div>
        )}

        <div style={{ padding: "0 20px 16px" }}>
          <div
            style={{
              background: NAVY,
              color: "#FFFFFF",
              padding: "8px 12px",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {t("payslip.earnings")}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {earningsRows.map((r) => (
                <tr key={r.key} style={{ borderBottom: "0.5px solid #DDE1EA" }}>
                  <td style={{ padding: "8px 0" }}>{r.label}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{Number(r.amount).toLocaleString()}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: "10px 0", fontWeight: 600, color: NAVY }}>{t("payslip.gross")}</td>
                <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 600, color: NAVY }}>
                  {Number(row.gross_salary).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          <div
            style={{
              background: "#C62828",
              color: "#FFFFFF",
              padding: "8px 12px",
              fontWeight: 600,
              fontSize: 13,
              marginTop: 12,
            }}
          >
            {t("payslip.deductions")}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {deductionRows.map((r) => (
                <tr key={r.key} style={{ borderBottom: "0.5px solid #DDE1EA" }}>
                  <td style={{ padding: "8px 0" }}>{r.label}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{Number(r.amount).toLocaleString()}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: "10px 0", fontWeight: 600 }}>{t("payslip.total_deductions")}</td>
                <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 600 }}>
                  {totalDed.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          <div
            style={{
              marginTop: 16,
              background: NAVY,
              color: "#FFFFFF",
              padding: "14px 16px",
              textAlign: "center",
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            {t("payslip.net")}: LAK {Number(row.net_salary).toLocaleString()}
          </div>
        </div>

        <div style={{ padding: "12px 20px", fontSize: 12, color: "#7A8599", borderTop: "0.5px solid #DDE1EA" }}>
          {t("payslip.footer")} · {printToday}
        </div>
      </div>

      <style>{`
        @media print {
          .payslip-no-print { display: none !important; }
          aside, nav, header { display: none !important; }
        }
      `}</style>
    </div>
  );
}
