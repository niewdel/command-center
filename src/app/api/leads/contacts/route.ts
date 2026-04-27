import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const params = req.nextUrl.searchParams;
  const companyId = params.get("company_id");
  const roleType = params.get("role_type");
  const verifiedOnly = params.get("verified") === "true";
  const page = parseInt(params.get("page") ?? "1");
  const limit = parseInt(params.get("limit") ?? "200");
  const offset = (page - 1) * limit;

  let query = sb
    .from("contacts")
    .select(
      "id, full_name, first_name, last_name, title, email, email_verified, linkedin_url, role_type, is_primary, created_at, companies(id, name, domain, industry, city, state, status, revenue_range, headcount)",
      { count: "exact" }
    )
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (companyId) query = query.eq("company_id", companyId);
  if (roleType) query = query.eq("role_type", roleType);
  if (verifiedOnly) query = query.eq("email_verified", true);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count ?? 0, page, limit });
}
