import { TableOutlined } from "@ant-design/icons";
import { Menu } from "antd";
import type { MenuProps } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { apiClient } from "@/api/client";
import { ROUTES, ROLES } from "@/config/constants";
import { useAuth } from "@/hooks/useAuth";
import type { ApiEnvelope } from "@/types/auth";
import { useUiStore } from "@/store/uiStore";

const ALL_ROLES = Object.values(ROLES);
const BULK_UPLOAD_ROLES = [ROLES.MANAGER, ROLES.ADMIN] as const;
/** Master data lookups + Manager / Dept Officer scope screens. */
const MASTER_ROLES = [ROLES.MANAGER, ROLES.DEPT_OFFICER, ROLES.ADMIN] as const;
const MANAGER_SCOPE_ROLES = [ROLES.DEPT_OFFICER, ROLES.ADMIN] as const;
const DEPT_OFFICER_MASTER_ROLES = [ROLES.ADMIN] as const;
const AUDIT_ROLES = [ROLES.ADMIN] as const;
const REGISTRATION_ROLES = [ROLES.MANAGER, ROLES.ADMIN] as const;
const EMPLOYEE_NEW_ROLES = [ROLES.MANAGER, ROLES.ADMIN] as const;
const GRID_ENTRY_ROLES = [ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.ADMIN] as const;

type NavLeaf = {
  type: "leaf";
  key: string;
  labelKey: string;
  path: string;
  roles: readonly string[];
};

type NavSub = {
  type: "sub";
  key: string;
  labelKey: string;
  roles: readonly string[];
  children: NavLeaf[];
};

type NavItem = NavLeaf | NavSub;

function isSub(item: NavItem): item is NavSub {
  return item.type === "sub";
}

/** Match `selectedKeys` to Ant Design `Menu` item keys (paths for leaves). */
function menuSelectedKey(pathname: string, myProfileEditPath: string | null): string {
  if (pathname.startsWith("/employees/grid-entry")) return ROUTES.employeeGridEntry;
  if (pathname.startsWith("/employees/bulk-upload")) return "/employees/bulk-upload";
  if (pathname.startsWith("/employees/new")) return ROUTES.employeeNew;
  if (myProfileEditPath && pathname === myProfileEditPath) return myProfileEditPath;
  if (pathname.startsWith("/employees/") && pathname.includes("/edit")) return ROUTES.employees;
  if (pathname.startsWith("/employees")) return ROUTES.employees;
  if (pathname.startsWith("/payroll/payslip")) return ROUTES.payrollMonthly;
  if (pathname.startsWith("/payroll")) return ROUTES.payrollMonthly;
  if (pathname.startsWith("/master")) return pathname.split("?")[0] || ROUTES.masterGradeStep;
  if (pathname.startsWith("/dashboards")) return ROUTES.dashboards;
  if (pathname.startsWith("/dashboard")) return ROUTES.dashboard;
  if (pathname.startsWith("/audit")) return ROUTES.audit;
  if (pathname.startsWith("/admin/registrations")) return ROUTES.adminRegistrations;
  if (pathname.startsWith("/admin/users")) return ROUTES.adminUsers;
  if (pathname.startsWith("/admin")) return ROUTES.adminUsers;
  return pathname;
}

const NAV: NavItem[] = [
  { type: "leaf", key: ROUTES.dashboard, labelKey: "nav.dashboard", path: ROUTES.dashboard, roles: ALL_ROLES },
  {
    type: "sub",
    key: "sub-emp",
    labelKey: "nav.employees",
    roles: ALL_ROLES,
    children: [
      {
        type: "leaf",
        key: ROUTES.employees,
        labelKey: "nav.employee_list",
        path: ROUTES.employees,
        roles: ALL_ROLES,
      },
      {
        type: "leaf",
        key: ROUTES.employeeNew,
        labelKey: "nav.employee_new",
        path: ROUTES.employeeNew,
        roles: EMPLOYEE_NEW_ROLES,
      },
      {
        type: "leaf",
        key: "/employees/bulk-upload",
        labelKey: "common.bulk_upload",
        path: "/employees/bulk-upload",
        roles: BULK_UPLOAD_ROLES,
      },
      {
        type: "leaf",
        key: ROUTES.employeeGridEntry,
        labelKey: "nav.grid_entry",
        path: ROUTES.employeeGridEntry,
        roles: GRID_ENTRY_ROLES,
      },
    ],
  },
  {
    type: "sub",
    key: "sub-master",
    labelKey: "nav.master",
    roles: MASTER_ROLES,
    children: [
      {
        type: "leaf",
        key: ROUTES.masterGradeStep,
        labelKey: "page.master.gradeStep.title",
        path: ROUTES.masterGradeStep,
        roles: MASTER_ROLES,
      },
      {
        type: "leaf",
        key: ROUTES.masterAllowanceRates,
        labelKey: "page.master.allowanceRates.title",
        path: ROUTES.masterAllowanceRates,
        roles: MASTER_ROLES,
      },
      {
        type: "leaf",
        key: ROUTES.masterGradeDerivation,
        labelKey: "page.master.gradeDerivation.title",
        path: ROUTES.masterGradeDerivation,
        roles: MASTER_ROLES,
      },
      {
        type: "leaf",
        key: ROUTES.masterOrg,
        labelKey: "page.master.org.title",
        path: ROUTES.masterOrg,
        roles: MASTER_ROLES,
      },
      {
        type: "leaf",
        key: ROUTES.masterLocation,
        labelKey: "page.master.location.title",
        path: ROUTES.masterLocation,
        roles: MASTER_ROLES,
      },
      {
        type: "leaf",
        key: ROUTES.masterBank,
        labelKey: "page.master.bank.title",
        path: ROUTES.masterBank,
        roles: MASTER_ROLES,
      },
      {
        type: "leaf",
        key: ROUTES.masterPit,
        labelKey: "page.master.pitBrackets.title",
        path: ROUTES.masterPit,
        roles: MASTER_ROLES,
      },
      {
        type: "leaf",
        key: ROUTES.masterManagers,
        labelKey: "nav.manager_master",
        path: ROUTES.masterManagers,
        roles: MANAGER_SCOPE_ROLES,
      },
      {
        type: "leaf",
        key: ROUTES.masterDeptOfficers,
        labelKey: "nav.dept_officer_master",
        path: ROUTES.masterDeptOfficers,
        roles: DEPT_OFFICER_MASTER_ROLES,
      },
    ],
  },
  {
    type: "leaf",
    key: ROUTES.audit,
    labelKey: "nav.audit",
    path: ROUTES.audit,
    roles: AUDIT_ROLES,
  },
  {
    type: "leaf",
    key: ROUTES.adminRegistrations,
    labelKey: "nav.pending_registrations",
    path: ROUTES.adminRegistrations,
    roles: REGISTRATION_ROLES,
  },
  {
    type: "leaf",
    key: ROUTES.adminUsers,
    labelKey: "nav.admin_users",
    path: ROUTES.adminUsers,
    roles: [ROLES.ADMIN],
  },
];

export function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const role = user?.role;
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  const { data: myEmployee } = useQuery({
    queryKey: ["employees", "me"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<{ employee_code: string }>>("/api/v1/employees/me");
      if (!data.success || data.data === null) {
        throw new Error("employees/me");
      }
      return data.data;
    },
    enabled: role === ROLES.EMPLOYEE,
    staleTime: 60_000,
    retry: false,
  });
  const myProfileEditPath =
    myEmployee?.employee_code != null && myEmployee.employee_code !== ""
      ? `/employees/${myEmployee.employee_code}/edit`
      : null;

  const [openKeys, setOpenKeys] = useState<string[]>([]);

  useEffect(() => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (pathname.startsWith("/employees")) next.add("sub-emp");
      if (pathname.startsWith("/master")) next.add("sub-master");
      return Array.from(next);
    });
  }, [pathname]);

  const menuItems: MenuProps["items"] = useMemo(() => {
    const items: MenuProps["items"] = [];
    if (role === ROLES.EMPLOYEE && myProfileEditPath) {
      items.push({
        key: myProfileEditPath,
        label: t("nav.my_profile"),
        onClick: () => navigate(myProfileEditPath),
      });
    }
    for (const entry of NAV) {
      if (isSub(entry)) {
        if (!entry.roles.some((r) => role === r)) continue;
        const children = entry.children
          .filter((c) => c.roles.some((r) => role === r))
          .map((c) => ({
            key: c.key,
            icon: c.key === ROUTES.employeeGridEntry ? <TableOutlined /> : undefined,
            label: t(c.labelKey),
            onClick: () => navigate(c.path),
          }));
        if (children.length === 0) continue;
        items.push({
          key: entry.key,
          label: t(entry.labelKey),
          children,
        });
      } else {
        if (!entry.roles.some((r) => role === r)) continue;
        items.push({
          key: entry.key,
          label: t(entry.labelKey),
          onClick: () => navigate(entry.path),
        });
      }
    }
    return items;
  }, [role, navigate, t, myProfileEditPath]);

  const selectedKeys = [menuSelectedKey(pathname, myProfileEditPath)];

  return (
    <Menu
      mode="inline"
      inlineCollapsed={collapsed}
      selectedKeys={selectedKeys}
      openKeys={collapsed ? [] : openKeys}
      onOpenChange={setOpenKeys}
      items={menuItems}
      style={{ height: "100%" }}
    />
  );
}
