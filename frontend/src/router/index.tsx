import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { ROLES } from "@/config/constants";
import { AuditTrailPage } from "@/pages/audit/AuditTrailPage";
import { ChangePasswordPage } from "@/pages/ChangePasswordPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { RegisterSuccessPage } from "@/pages/auth/RegisterSuccessPage";
import { RegistrationsPage } from "@/pages/admin/RegistrationsPage";
import { UserManagementPage } from "@/pages/admin/UserManagementPage";
import { BulkUploadPage } from "@/pages/employees/BulkUploadPage";
import { EmployeeFormPage } from "@/pages/employees/EmployeeFormPage";
import { EmployeeListPage } from "@/pages/employees/EmployeeListPage";
import { GridEntryPage } from "@/pages/employees/GridEntryPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { SupersetDashboardPage } from "@/pages/dashboards/SupersetDashboardPage";
import { AllowanceRatesPage } from "@/pages/master/AllowanceRatesPage";
import { BankMasterPage } from "@/pages/master/BankMasterPage";
import { DeptOfficerMasterPage } from "@/pages/master/DeptOfficerMasterPage";
import { GradeDerivationPage } from "@/pages/master/GradeDerivationPage";
import { GradeStepPage } from "@/pages/master/GradeStepPage";
import { LocationMasterPage } from "@/pages/master/LocationMasterPage";
import { ManagerMasterPage } from "@/pages/master/ManagerMasterPage";
import { OrgMasterPage } from "@/pages/master/OrgMasterPage";
import { PITBracketsPage } from "@/pages/master/PITBracketsPage";
import { PayrollMonthlyPage } from "@/pages/payroll/PayrollMonthlyPage";
import { PayslipPage } from "@/pages/payroll/PayslipPage";

const ALL_APP_ROLES = [
  ROLES.EMPLOYEE,
  ROLES.MANAGER,
  ROLES.DEPT_OFFICER,
  ROLES.ADMIN,
];

const GRID_ENTRY_ROLES = [ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.ADMIN];

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/success" element={<RegisterSuccessPage />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute roles={ALL_APP_ROLES}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="dashboards" element={<SupersetDashboardPage />} />
        <Route path="employees" element={<EmployeeListPage />} />
        <Route path="employees/new" element={<EmployeeFormPage />} />
        <Route
          path="employees/bulk-upload"
          element={
            <ProtectedRoute roles={[ROLES.MANAGER, ROLES.ADMIN]}>
              <BulkUploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="employees/grid-entry"
          element={
            <ProtectedRoute roles={GRID_ENTRY_ROLES}>
              <GridEntryPage />
            </ProtectedRoute>
          }
        />
        <Route path="employees/:code/edit" element={<EmployeeFormPage />} />
        <Route
          path="payroll/monthly"
          element={
            <ProtectedRoute roles={[ROLES.MANAGER, ROLES.ADMIN]}>
              <PayrollMonthlyPage />
            </ProtectedRoute>
          }
        />
        <Route path="payroll/payslip/:code/:month" element={<PayslipPage />} />
        <Route
          path="master/grade-step"
          element={
            <ProtectedRoute roles={[ROLES.MANAGER, ROLES.DEPT_OFFICER, ROLES.ADMIN]}>
              <GradeStepPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="master/allowance-rates"
          element={
            <ProtectedRoute roles={[ROLES.MANAGER, ROLES.DEPT_OFFICER, ROLES.ADMIN]}>
              <AllowanceRatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="master/grade-derivation"
          element={
            <ProtectedRoute roles={[ROLES.MANAGER, ROLES.DEPT_OFFICER, ROLES.ADMIN]}>
              <GradeDerivationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="master/org"
          element={
            <ProtectedRoute roles={[ROLES.MANAGER, ROLES.DEPT_OFFICER, ROLES.ADMIN]}>
              <OrgMasterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="master/location"
          element={
            <ProtectedRoute roles={[ROLES.MANAGER, ROLES.DEPT_OFFICER, ROLES.ADMIN]}>
              <LocationMasterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="master/bank"
          element={
            <ProtectedRoute roles={[ROLES.MANAGER, ROLES.DEPT_OFFICER, ROLES.ADMIN]}>
              <BankMasterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="master/pit-brackets"
          element={
            <ProtectedRoute roles={[ROLES.MANAGER, ROLES.DEPT_OFFICER, ROLES.ADMIN]}>
              <PITBracketsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="master/managers"
          element={
            <ProtectedRoute roles={[ROLES.DEPT_OFFICER, ROLES.ADMIN]}>
              <ManagerMasterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="master/dept-officers"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <DeptOfficerMasterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="audit"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <AuditTrailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/registrations"
          element={
            <ProtectedRoute roles={[ROLES.MANAGER, ROLES.ADMIN]}>
              <RegistrationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
