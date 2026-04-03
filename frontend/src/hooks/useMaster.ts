import { useQuery } from "@tanstack/react-query";

import { fetchGradeSteps } from "@/api/master";

export function useGradeStep() {
  return useQuery({
    queryKey: ["master", "grade-step"],
    queryFn: async () => {
      const res = await fetchGradeSteps();
      if (!res.success || !res.data) throw new Error("load");
      return res.data;
    },
    staleTime: 300_000,
  });
}
