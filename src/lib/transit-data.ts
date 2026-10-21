// Browser data access for the transport network (Lovable Cloud).
// Reading is public; writing is only allowed for admins (enforced by database security rules).

import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadNetwork, type Network } from "./network";

export type { Network };

export const networkQuery = queryOptions({
  queryKey: ["network"],
  queryFn: () => loadNetwork(supabase),
  staleTime: 30_000,
});

export function useNetwork() {
  return useQuery(networkQuery);
}

/** Current time, refreshed on an interval — drives the simulated bus movement. */
export function useNow(intervalMs = 2000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
