import { useQuery } from "@tanstack/react-query";

import { getMinistries } from "@/api/lookups";

export function useMinistries() {
  return useQuery({
    queryKey: ["lookups", "ministries"],
    queryFn: () => getMinistries(),
  });
}
