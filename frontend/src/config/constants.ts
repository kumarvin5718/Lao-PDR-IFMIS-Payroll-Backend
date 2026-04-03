export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const TOKEN_KEY = "access_token_memory_only";

/** v4.0 role model (Phase 4). */
export const ROLES = {
  EMPLOYEE: "ROLE_EMPLOYEE",
  MANAGER: "ROLE_MANAGER",
  DEPT_OFFICER: "ROLE_DEPT_OFFICER",
  ADMIN: "ROLE_ADMIN",
} as const;

export const ROUTES = {
  login: "/login",
  register: "/register",
  registerSuccess: "/register/success",
  changePassword: "/change-password",
  dashboard: "/dashboard",
  employees: "/employees",
  employeeNew: "/employees/new",
  employeeGridEntry: "/employees/grid-entry",
  employeeEdit: (code: string) => `/employees/${code}/edit`,
  payrollMonthly: "/payroll/monthly",
  payslip: (code: string, month: string) => `/payroll/payslip/${code}/${month}`,
  masterGradeStep: "/master/grade-step",
  masterAllowanceRates: "/master/allowance-rates",
  masterGradeDerivation: "/master/grade-derivation",
  masterOrg: "/master/org",
  masterLocation: "/master/location",
  masterBank: "/master/bank",
  masterPit: "/master/pit-brackets",
  masterManagers: "/master/managers",
  masterDeptOfficers: "/master/dept-officers",
  dashboards: "/dashboards",
  audit: "/audit",
  adminUsers: "/admin/users",
  adminRegistrations: "/admin/registrations",
} as const;
