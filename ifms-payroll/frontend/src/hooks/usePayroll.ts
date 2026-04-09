/** React Query hook: `usePayroll` — data fetching and cache keys. */
import { useQuery } from "@tanstack/react-query";

import { listMonthlyPayroll } from "@/api/payroll";

export function useMonthlyPayroll(params: Record<string, unknown>) {
  return useQuery({
    queryKey: ["payroll-monthly", params],
    queryFn: () => listMonthlyPayroll(params),
  });
}
