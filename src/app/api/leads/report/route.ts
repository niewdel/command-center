import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/leads/db";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  queued: "#9CA3AF",
  sent: "#00B4D8",
  opened: "#F59E0B",
  replied: "#10B981",
  bounced: "#EF4444",
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  sent: "Sent",
  opened: "Opened",
  replied: "Replied",
  bounced: "Bounced",
};

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest) {
  const sb = getServiceClient();
  const params = req.nextUrl.searchParams;
  const limit = parseInt(params.get("limit") ?? "100");
  const verticalId = params.get("vertical_id");

  let q = sb
    .from("contacts")
    .select(
      "id, full_name, title, email, phone, linkedin_url, lead_score, status, companies(name, industry, headcount, revenue_range, founded_year, latest_funding_stage, city, state, technologies, vertical_id)"
    )
    .eq("is_primary", true)
    .order("lead_score", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (verticalId) q = q.eq("companies.vertical_id", verticalId);
  const { data: contacts } = await q;

  const rows = (contacts ?? []) as unknown as Array<{
    id: string;
    full_name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
    lead_score: number | null;
    status: string;
    companies: {
      name: string;
      industry: string | null;
      headcount: number | null;
      revenue_range: string | null;
      founded_year: number | null;
      latest_funding_stage: string | null;
      city: string | null;
      state: string | null;
      technologies: string[] | null;
    } | null;
  }>;

  // First-touch emails for the cover preview
  const contactIds = rows.map((r) => r.id);
  let firstEmail = new Map<string, { subject: string; body: string }>();
  if (contactIds.length) {
    const { data: emails } = await sb
      .from("outreach_emails")
      .select("contact_id, step_number, subject, body_plain")
      .in("contact_id", contactIds)
      .eq("step_number", 1);
    for (const e of emails ?? []) {
      firstEmail.set(e.contact_id, {
        subject: e.subject ?? "",
        body: e.body_plain ?? "",
      });
    }
  }

  const totalContacted = rows.filter((r) => r.status !== "queued" && r.status !== "bounced").length;
  const totalReplied = rows.filter((r) => r.status === "replied").length;
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const cards = rows
    .map((r) => {
      const c = r.companies;
      if (!c) return "";
      const score = r.lead_score ?? 0;
      const scoreColor = score >= 85 ? "#10B981" : score >= 60 ? "#F59E0B" : "#9CA3AF";
      const statusColor = STATUS_COLOR[r.status] ?? "#9CA3AF";
      const statusLabel = STATUS_LABEL[r.status] ?? r.status;
      const tech = (c.technologies ?? []).slice(0, 10);
      const headcount = c.headcount ? `${c.headcount} employees` : "—";
      const hq = [c.city, c.state].filter(Boolean).join(", ") || "—";
      const email = firstEmail.get(r.id);

      return `
        <div class="lead">
          <div class="lead-header">
            <div>
              <div class="lead-company">${esc(c.name)}</div>
              <div class="lead-contact">${esc(r.full_name)} / ${esc(r.title ?? "—")} / ${esc(c.industry ?? "—")} / ${esc(headcount)}</div>
            </div>
            <div style="text-align:right">
              <div class="score" style="color:${scoreColor}">${score}</div>
              <span class="status" style="color:${statusColor}">${statusLabel}</span>
            </div>
          </div>
          <div class="enrichment">
            <div><div class="enr-label">Revenue</div>${esc(c.revenue_range ?? "—")}</div>
            <div><div class="enr-label">Funding</div>${esc(c.latest_funding_stage ?? "—")}</div>
            <div><div class="enr-label">Founded</div>${c.founded_year ?? "—"}</div>
            <div><div class="enr-label">HQ</div>${esc(hq)}</div>
          </div>
          ${tech.length ? `<div>Tech: ${tech.map((t) => `<span class="tech">${esc(t)}</span>`).join("")}</div>` : ""}
          <div class="contact-info">
            ${r.email ? `<span>${esc(r.email)}</span>` : ""}
            ${r.phone ? `<span>${esc(r.phone)}</span>` : ""}
            ${r.linkedin_url ? `<span>${esc(r.linkedin_url)}</span>` : ""}
          </div>
          ${email ? `
          <div class="email-section">
            <div class="email-subject">Subject: ${esc(email.subject)}</div>
            <div class="email-body">${esc(email.body)}</div>
          </div>` : ""}
        </div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Lead Generation Report — Niewdel</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0D0D0D; padding-bottom: 20px; margin-bottom: 8px; }
  .logo { font-size: 28px; font-weight: 800; letter-spacing: -0.03em; }
  .logo-sub { font-size: 10px; color: #666; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 2px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 12px; color: #666; }
  .stats { display: flex; gap: 32px; margin-bottom: 28px; }
  .stat { text-align: center; }
  .stat-val { font-size: 28px; font-weight: 700; }
  .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin-top: 2px; }
  .lead { border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .lead-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .lead-company { font-size: 15px; font-weight: 700; }
  .lead-contact { font-size: 11px; color: #666; }
  .score { font-size: 22px; font-weight: 800; }
  .status { font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; }
  .enrichment { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin: 8px 0; font-size: 11px; }
  .enr-label { font-size: 9px; text-transform: uppercase; color: #999; }
  .email-section { background: #f9f9f9; border-radius: 6px; padding: 12px; margin-top: 10px; }
  .email-subject { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
  .email-body { font-size: 11px; color: #555; line-height: 1.6; white-space: pre-wrap; }
  .tech { display: inline-block; font-size: 10px; padding: 2px 6px; border-radius: 3px; background: #E0F2FE; color: #0369A1; margin: 0 4px 4px 0; }
  .contact-info { display: flex; gap: 12px; flex-wrap: wrap; font-size: 10px; color: #888; margin-top: 6px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 10px; color: #999; text-align: center; }
  @media print { body { padding: 20px; } .lead { break-inside: avoid; } .actions { display: none; } }
  .actions { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; }
  .actions button { padding: 8px 14px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid #ddd; background: #fff; cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em; }
  .actions button.primary { background: #0D0D0D; color: #fff; border-color: #0D0D0D; }
</style></head><body>
  <div class="actions">
    <button onclick="window.close()">Close</button>
    <button class="primary" onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="header">
    <div><div class="logo">niewdel</div><div class="logo-sub">Lead Generation Report</div></div>
    <div style="text-align:right;font-size:11px;color:#888;">
      <div>Outbound Prospecting Campaign</div>
      <div>AI-Generated Sequences</div>
    </div>
  </div>
  <div class="meta">
    <span>Generated: ${generatedDate}</span>
    <span>Powered by Niewdel Lead Gen Agent</span>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-val">${rows.length}</div><div class="stat-label">Prospects</div></div>
    <div class="stat"><div class="stat-val">${totalContacted}</div><div class="stat-label">Contacted</div></div>
    <div class="stat"><div class="stat-val">${totalReplied}</div><div class="stat-label">Replied</div></div>
  </div>
  ${cards}
  <div class="footer">niewdel.com / Lead Generation Agent</div>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
