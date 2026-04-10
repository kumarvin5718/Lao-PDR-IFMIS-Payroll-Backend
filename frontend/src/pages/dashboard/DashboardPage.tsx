/** Screen: `DashboardPage` — page-level UI and mutations. */
import {
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { Alert, Card, Col, Empty, Progress, Row, Select, Skeleton, Statistic, Typography } from "antd";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";

import {
  type ScopeStats,
  useDashboardSummary,
  useDeptStats,
  useEmploymentMix,
  useFillRate,
  useGradeDist,
  useLocationStats,
  useManagerStats,
  usePayrollTrend,
} from "@/api/dashboard";
import { useDepartments, useProvinces } from "@/api/lookups";
import { useManagerScopes } from "@/api/masterScope";
import { ROUTES, ROLES } from "@/config/constants";
import { useAuth } from "@/hooks/useAuth";

const CHART_COLORS = ["#1890ff", "#52c41a", "#faad14", "#ff4d4f"];

const KPI_CARD_STYLE = { height: "100%" as const };
const KPI_CARD_BODY_STYLE = { padding: "16px 20px" as const };
const KPI_STATISTIC_VALUE_STYLE = { fontSize: 24, fontWeight: "bold" as const };

function KpiStatisticTitle({ children }: { children: ReactNode }) {
  return <span style={{ whiteSpace: "nowrap", fontSize: 13 }}>{children}</span>;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function formatLak(n: number): string {
  return new Intl.NumberFormat("en-LA", { maximumFractionDigits: 0 }).format(n);
}

function ScopeStatCard({
  stats,
  loading,
  isError,
}: {
  stats?: ScopeStats;
  loading: boolean;
  isError?: boolean;
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <Card size="small" style={{ marginTop: 12 }}>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    );
  }
  if (isError) {
    return (
      <Card size="small" style={{ marginTop: 12 }}>
        <Alert type="error" message={t("dashboard.statsError")} showIcon />
      </Card>
    );
  }
  if (!stats) return null;
  const pct = Math.min(100, Math.max(0, stats.fill_rate_pct));
  return (
    <Card size="small" style={{ marginTop: 12 }}>
      <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
        {t("dashboard.totalInScope")}: {stats.total}
      </Typography.Text>
      <Progress
        percent={Number(pct.toFixed(1))}
        strokeColor="#52c41a"
        trailColor="#ff4d4f"
        format={() => t("dashboard.progressFilled", { pct: stats.fill_rate_pct.toFixed(1) })}
      />
      <div style={{ marginTop: 8 }}>
        <Typography.Text style={{ color: "#52c41a" }}>{stats.complete}</Typography.Text>
        <Typography.Text> {t("dashboard.filledLabel")} </Typography.Text>
        <Typography.Text type="secondary"> | </Typography.Text>
        <Typography.Text style={{ color: "#ff4d4f" }}>{stats.incomplete}</Typography.Text>
        <Typography.Text> {t("dashboard.pendingLabel")}</Typography.Text>
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;

  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);

  const showKpiDataQuality = role === ROLES.MANAGER || role === ROLES.ADMIN;
  const showKpiPending = role === ROLES.MANAGER || role === ROLES.ADMIN;
  const showKpiPayroll = role === ROLES.ADMIN;
  const showLocationFilter = role === ROLES.MANAGER || role === ROLES.ADMIN;
  const showManagerFilter =
    role === ROLES.ADMIN || role === ROLES.DEPT_OFFICER || role === ROLES.MANAGER;
  const showFillRateChart = role === ROLES.MANAGER || role === ROLES.ADMIN;
  const showPayrollTrend = role === ROLES.ADMIN;

  const departmentsQ = useDepartments();
  const provincesQ = useProvinces();
  const managerScopeQ = useManagerScopes(
    { page: 1, pageSize: 2000, search: "", activeOnly: true },
    { enabled: role === ROLES.ADMIN || role === ROLES.DEPT_OFFICER },
  );

  const deptStatsQ = useDeptStats(selectedDept);
  const locationStatsQ = useLocationStats(selectedLocation);
  const managerStatsQ = useManagerStats(selectedManagerId);

  const summaryQ = useDashboardSummary();
  const fillQ = useFillRate();
  const gradeQ = useGradeDist();
  const mixQ = useEmploymentMix();
  const trendQ = usePayrollTrend({ enabled: showPayrollTrend });

  const summary = summaryQ.data;
  const fillRows = fillQ.data?.data ?? [];
  const gradeRows = gradeQ.data?.data ?? [];
  const mixRows = mixQ.data?.data ?? [];
  const trendRows = trendQ.data?.data ?? [];

  const departments = departmentsQ.data ?? [];
  const provinces = provincesQ.data ?? [];
  const managerScopeRows = managerScopeQ.data?.items ?? [];

  const managerOptions = useMemo(() => {
    if (role === ROLES.MANAGER && user) {
      return [{ value: user.user_id, label: user.full_name }];
    }
    const map = new Map<string, { value: string; label: string }>();
    for (const r of managerScopeRows) {
      if (!r.is_active) continue;
      if (!map.has(r.user_id)) {
        map.set(r.user_id, {
          value: r.user_id,
          label: `${r.full_name} (${r.username})`,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [role, user, managerScopeRows]);

  const filterColCount =
    1 + (showLocationFilter ? 1 : 0) + (showManagerFilter ? 1 : 0);
  const filterColSpan = filterColCount === 3 ? 8 : filterColCount === 2 ? 12 : 24;

  const trendForChart = useMemo(
    () =>
      trendRows.map((r) => ({
        ...r,
        gross_m: r.gross / 1_000_000,
        net_m: r.net / 1_000_000,
      })),
    [trendRows],
  );

  const kpiLoading = summaryQ.isLoading;

  return (
    <div style={{ padding: 24, width: "100%", maxWidth: "100%" }}>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        {t("dashboard.title")}
      </Typography.Title>

      <Row gutter={[16, 16]} wrap={false} style={{ width: "100%", marginBottom: 24 }}>
        <Col flex="1" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Card style={KPI_CARD_STYLE} bodyStyle={KPI_CARD_BODY_STYLE}>
            {kpiLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title={<KpiStatisticTitle>{t("dashboard.totalEmployees")}</KpiStatisticTitle>}
                value={summary?.total_employees ?? 0}
                prefix={<TeamOutlined style={{ color: "#1890ff" }} />}
                valueStyle={KPI_STATISTIC_VALUE_STYLE}
              />
            )}
          </Card>
        </Col>
        {showKpiDataQuality && (
          <Col flex="1" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <Card style={KPI_CARD_STYLE} bodyStyle={KPI_CARD_BODY_STYLE}>
              {kpiLoading ? (
                <Skeleton active paragraph={{ rows: 2 }} />
              ) : (
                <div>
                  <Statistic
                    title={<KpiStatisticTitle>{t("dashboard.dataComplete")}</KpiStatisticTitle>}
                    value={summary?.complete_employees ?? 0}
                    suffix={`/ ${summary?.total_employees ?? 0}`}
                    prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
                    valueStyle={KPI_STATISTIC_VALUE_STYLE}
                  />
                  <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                    {summary?.fill_rate_pct ?? 0}% {t("dashboard.complete").toLowerCase()}
                  </Typography.Text>
                </div>
              )}
            </Card>
          </Col>
        )}
        {showKpiPending && (
          <Col flex="1" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <Card
              hoverable
              onClick={() => navigate(ROUTES.adminRegistrations)}
              style={{ ...KPI_CARD_STYLE, cursor: "pointer" }}
              bodyStyle={KPI_CARD_BODY_STYLE}
            >
              {kpiLoading ? (
                <Skeleton active paragraph={{ rows: 1 }} />
              ) : (
                <Statistic
                  title={<KpiStatisticTitle>{t("dashboard.pendingRegistrations")}</KpiStatisticTitle>}
                  value={summary?.pending_registrations ?? 0}
                  prefix={<ClockCircleOutlined style={{ color: "#faad14" }} />}
                  valueStyle={KPI_STATISTIC_VALUE_STYLE}
                />
              )}
            </Card>
          </Col>
        )}
        {showKpiPayroll && (
          <>
            <Col flex="1" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <Card style={KPI_CARD_STYLE} bodyStyle={KPI_CARD_BODY_STYLE}>
                {kpiLoading ? (
                  <Skeleton active paragraph={{ rows: 1 }} />
                ) : (
                  <Statistic
                    title={<KpiStatisticTitle>{t("dashboard.grossPayroll")}</KpiStatisticTitle>}
                    value={formatLak(summary?.gross_payroll_current ?? 0)}
                    prefix={<BankOutlined style={{ color: "#722ed1" }} />}
                    valueStyle={KPI_STATISTIC_VALUE_STYLE}
                  />
                )}
              </Card>
            </Col>
            <Col flex="1" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <Card style={KPI_CARD_STYLE} bodyStyle={KPI_CARD_BODY_STYLE}>
                {kpiLoading ? (
                  <Skeleton active paragraph={{ rows: 1 }} />
                ) : (
                  <Statistic
                    title={<KpiStatisticTitle>{t("dashboard.netPayroll")}</KpiStatisticTitle>}
                    value={formatLak(summary?.net_payroll_current ?? 0)}
                    prefix={<WalletOutlined style={{ color: "#13c2c2" }} />}
                    valueStyle={KPI_STATISTIC_VALUE_STYLE}
                  />
                )}
              </Card>
            </Col>
          </>
        )}
      </Row>

      <Card title={t("dashboard.filterPanel")} style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={filterColSpan}>
            <Select
              allowClear
              showSearch
              placeholder={t("dashboard.selectDepartment")}
              style={{ width: "100%" }}
              options={departments.map((d) => ({ label: d, value: d }))}
              value={selectedDept ?? undefined}
              onChange={(v) => setSelectedDept(v ?? null)}
              loading={departmentsQ.isLoading}
              optionFilterProp="label"
            />
            {selectedDept ? (
              <ScopeStatCard
                loading={deptStatsQ.isLoading || deptStatsQ.isFetching}
                stats={deptStatsQ.data}
                isError={deptStatsQ.isError}
              />
            ) : null}
          </Col>
          {showLocationFilter ? (
            <Col xs={24} md={filterColSpan}>
              <Select
                allowClear
                showSearch
                placeholder={t("dashboard.selectLocation")}
                style={{ width: "100%" }}
                options={provinces.map((p) => ({ label: p, value: p }))}
                value={selectedLocation ?? undefined}
                onChange={(v) => setSelectedLocation(v ?? null)}
                loading={provincesQ.isLoading}
                optionFilterProp="label"
              />
              {selectedLocation ? (
                <ScopeStatCard
                  loading={locationStatsQ.isLoading || locationStatsQ.isFetching}
                  stats={locationStatsQ.data}
                  isError={locationStatsQ.isError}
                />
              ) : null}
            </Col>
          ) : null}
          {showManagerFilter ? (
            <Col xs={24} md={filterColSpan}>
              <Select
                allowClear
                showSearch
                placeholder={t("dashboard.selectManager")}
                style={{ width: "100%" }}
                options={managerOptions}
                value={selectedManagerId ?? undefined}
                onChange={(v) => setSelectedManagerId(v ?? null)}
                loading={role === ROLES.MANAGER ? false : managerScopeQ.isLoading}
                optionFilterProp="label"
              />
              {selectedManagerId ? (
                <ScopeStatCard
                  loading={managerStatsQ.isLoading || managerStatsQ.isFetching}
                  stats={managerStatsQ.data}
                  isError={managerStatsQ.isError}
                />
              ) : null}
            </Col>
          ) : null}
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {showFillRateChart && (
          <Col xs={24} lg={12}>
            <Card title={t("dashboard.fillRateByDept")}>
              {fillQ.isLoading ? (
                <Skeleton active paragraph={{ rows: 8 }} style={{ height: 280 }} />
              ) : fillRows.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={fillRows.map((r) => ({
                      ...r,
                      name: truncate(r.department_name, 15),
                    }))}
                    margin={{ bottom: 64, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={72} tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="complete" stackId="a" fill="#52c41a" name={t("dashboard.complete")} />
                    <Bar dataKey="incomplete" stackId="a" fill="#ff4d4f" name={t("dashboard.incomplete")} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>
        )}
        <Col xs={24} lg={showFillRateChart ? 12 : 24}>
          <Card title={t("dashboard.employmentMix")}>
            {mixQ.isLoading ? (
              <Skeleton active paragraph={{ rows: 8 }} style={{ height: 280 }} />
            ) : mixRows.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={mixRows}
                    dataKey="count"
                    nameKey="employment_type"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {mixRows.map((_, i) => (
                      <Cell key={String(i)} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, t("dashboard.employees")]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      {showPayrollTrend && (
        <Card title={t("dashboard.payrollTrend")} style={{ marginBottom: 24 }}>
          {trendQ.isLoading ? (
            <Skeleton active paragraph={{ rows: 10 }} style={{ height: 300 }} />
          ) : trendForChart.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={trendForChart} margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis
                  yAxisId="left"
                  label={{ value: t("dashboard.lakMillions"), angle: -90, position: "insideLeft" }}
                />
                <YAxis yAxisId="right" orientation="right" label={{ value: t("dashboard.headcount"), angle: 90 }} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === t("dashboard.headcount")) return [value, name];
                    return [formatLak(value * 1_000_000), name];
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="gross_m"
                  name={t("dashboard.gross")}
                  stroke="#722ed1"
                  dot={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="net_m"
                  name={t("dashboard.net")}
                  stroke="#13c2c2"
                  dot={false}
                />
                <Line yAxisId="right" type="monotone" dataKey="headcount" name={t("dashboard.headcount")} stroke="#fa8c16" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}

      <Card title={t("dashboard.gradeDist")}>
        {gradeQ.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} style={{ height: 240 }} />
        ) : gradeRows.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={gradeRows} margin={{ top: 16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grade" tickFormatter={(g) => `Grade ${g}`} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#722ed1" name={t("dashboard.headcount")}>
                <LabelList dataKey="count" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
