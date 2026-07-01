import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/seo/db";
import { renderFixPlanMarkdown } from "@/lib/seo/fix-plan-md";
import type { PageSnapshot, SeoConfig } from "@/lib/seo/types";
import { requireAgencyAdmin } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

// GET /api/seo/clients/{id}/fix-plan
//   ?format=markdown (default) → returns { markdown, filename }
//   ?format=raw                → returns text/markdown with Content-Disposition
//                                so the browser triggers a download.
//
// Builds the fix plan from the latest seo_check + all currently open
// seo_issues for the client. Designed to be pasted into Claude Code.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAgencyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const sb = getServiceClient();
  const format = request.nextUrl.searchParams.get("format") ?? "markdown";

  const { data: client } = await sb
    .from("clients")
    .select("id, name, seo_config")
    .eq("id", id)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data: check } = await sb
    .from("seo_checks")
    .select(
      "id, technical_score, onpage_score, lighthouse_mobile, lighthouse_desktop, pages_crawled, pages, ai_summary, created_at"
    )
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!check) {
    return NextResponse.json(
      { error: "No SEO check found for this client yet — run one first." },
      { status: 400 }
    );
  }

  const { data: issues } = await sb
    .from("seo_issues")
    .select(
      "id, fingerprint, severity, category, sub_type, page_url, title, description, recommendation, first_seen_at, last_seen_at"
    )
    .eq("client_id", id)
    .eq("status", "open")
    .order("severity", { ascending: true });

  const markdown = renderFixPlanMarkdown({
    client: {
      id: client.id as string,
      name: client.name as string,
      seo_config: (client.seo_config as SeoConfig | null) ?? null,
    },
    check: {
      id: check.id as string,
      technical_score: check.technical_score as number | null,
      onpage_score: check.onpage_score as number | null,
      lighthouse_mobile: check.lighthouse_mobile as number | null,
      lighthouse_desktop: check.lighthouse_desktop as number | null,
      pages_crawled: check.pages_crawled as number | null,
      pages: (check.pages as PageSnapshot[] | null) ?? null,
      ai_summary: check.ai_summary as string | null,
      created_at: check.created_at as string,
    },
    issues: (issues ?? []).map((i) => ({
      id: i.id as string,
      fingerprint: i.fingerprint as string,
      severity: i.severity as "critical" | "high" | "medium" | "low",
      category: i.category as string,
      sub_type: (i.sub_type as string | null) ?? null,
      page_url: (i.page_url as string | null) ?? null,
      title: i.title as string,
      description: (i.description as string | null) ?? null,
      recommendation: (i.recommendation as string | null) ?? null,
      first_seen_at: i.first_seen_at as string,
      last_seen_at: i.last_seen_at as string,
    })),
  });

  const safeName = (client.name as string)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const datePart = new Date().toISOString().split("T")[0];
  const filename = `seo-fix-plan-${safeName}-${datePart}.md`;

  if (format === "raw") {
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ markdown, filename });
}
