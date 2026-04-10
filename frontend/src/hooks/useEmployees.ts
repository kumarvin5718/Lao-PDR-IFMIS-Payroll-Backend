/** React Query hook: `useEmployees` — data fetching and cache keys. */
import { useQuery } from "@tanstack/react-query";

import { fetchEmployees, type EmployeeListParams } from "@/api/employees";

export function useEmployeeList(params: EmployeeListParams) {
  return useQuery({
    queryKey: ["employees", params],
    queryFn: () => fetchEmployees(params),
  });
}
