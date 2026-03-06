import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AggregateImpactResponse } from "@/lib/types";

export function useAggregateImpact(
  surtaxEnabled: boolean,
  enabled: boolean
) {
  return useQuery<AggregateImpactResponse>({
    queryKey: ["aggregateImpact", surtaxEnabled],
    queryFn: () => api.calculateAggregateImpact(surtaxEnabled),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
