/** TypeScript types shared with `employee` API responses. */
export interface Employee {
  employee_code: string;
}

export interface EmployeeListItem {
  employee_code: string;
}

export interface CreateEmployee {
  employee_code?: string;
}
