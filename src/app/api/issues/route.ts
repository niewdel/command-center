import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAgencyAdmin } from "@/lib/tenancy";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/issues — list all issues (optionally filter by status)
export async function GET(request: NextRequest) {
  if (!(await requireAgencyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = getSupabaseAdmin();
  const status = request.nextUrl.searchParams.get("status");

  let query = supabase.from("issues").select("*").order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ issues: data, count: data?.length || 0 });
}

// PATCH /api/issues — bulk update issues (mark as resolved/closed by system)
export async function PATCH(request: NextRequest) {
  if (!(await requireAgencyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = getSupabaseAdmin();
  const { ids, status, resolved_by } = await request.json();

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { status: status || "resolved" };
  if (resolved_by) {
    updates.resolved_by = resolved_by;
    updates.resolved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("issues")
    .update(updates)
    .in("id", ids)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: data, count: data?.length || 0 });
}
