import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const params = req.nextUrl.searchParams;
  const vertical = params.get("vertical");
  const status = params.get("status");
  const page = parseInt(params.get("page") ?? "1");
  const limit = parseInt(params.get("limit") ?? "100");
  const offset = (page - 1) * limit;

  let query = sb
    .from("companies")
    .select(
      "id, name, domain, industry, revenue_range, headcount, city, state, status, research_summary, researched_at, created_at, verticals(id, name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (vertical) query = query.eq("vertical_id", vertical);
  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count ?? 0, page, limit });
}
