/** React Query hook: `useLookups` — data fetching and cache keys. */
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client";
import type { ApiEnvelope } from "@/types/auth";

/** Ministry names for dropdowns (from lk_ministry_master via lookups API). */
export function useMinistries() {
  return useQuery({
    queryKey: ["lookups", "ministries"],
    queryFn: async () => {
      const { data } = await apiClient.get<
        ApiEnvelope<Array<{ ministry_key: string; ministry_name: string }>>
      >("/api/v1/lookups/ministries");
      if (!data.success || data.data === null) throw new Error("ministries");
      return data.data.map((x) => x.ministry_name);
    },
    staleTime: 300_000,
  });
}
