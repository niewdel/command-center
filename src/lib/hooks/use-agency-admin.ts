"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Client-side mirror of requireAgencyAdmin (src/lib/tenancy) for nav
// visibility only — the API routes enforce the real wall. Defaults to false
// (fail closed) until the RPC confirms, so non-admins never see the
// agency-internal sections flash in.
export function useIsAgencyAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data, error } = await supabase.rpc("is_agency_admin", {
        uid: user.id,
      });
      if (!cancelled && !error && data === true) setIsAdmin(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}
