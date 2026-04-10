/** React Query hook: `useMaster` — data fetching and cache keys. */
import { useQuery } from "@tanstack/react-query";

import { fetchGradeSteps } from "@/api/master";

export function useGradeStep() {
  return useQuery({
    queryKey: ["master", "grade-step", "all"],
    queryFn: async () => {
      const res = await fetchGradeSteps({ page: 1, size: 500 });
      if (!res.success || !res.data) throw new Error("load");
      return res.data.items;
    },
    staleTime: 300_000,
  });
}
