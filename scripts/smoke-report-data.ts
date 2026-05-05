// scripts/smoke-report-data.ts
import { getReportData } from "../src/lib/seo/report-data";

const CLIENT_ID = process.argv[2];
if (!CLIENT_ID) {
  console.error("Usage: tsx scripts/smoke-report-data.ts <client_id>");
  process.exit(1);
}

(async () => {
  const data = await getReportData(CLIENT_ID, "30d");
  console.log("client:", data.client);
  console.log("overall_score:", data.health.overall_score, "delta:", data.health.overall_delta);
  console.log("technical:", data.health.technical);
  console.log("open_issues:", data.health.open_issues);
  console.log("resolved count:", data.issues.resolved.length);
  console.log("history points:", data.history.length);
  console.log("ai_summary present:", !!data.ai_summary);
  console.log("traffic present:", !!data.traffic);
  if (data.traffic) {
    console.log("  sessions:", data.traffic.sessions);
    console.log("  organic:", data.traffic.organic_sessions);
    console.log("  users:", data.traffic.users);
    console.log("  pages/session:", data.traffic.pages_per_session);
    console.log("  sources:", data.traffic.sources);
    console.log("  period:", data.traffic.period_start, "→", data.traffic.period_end);
  }
  console.log("top_pages:", data.top_pages.length);
  data.top_pages.forEach((p) => console.log(`  ${p.path}: ${p.sessions} sessions (${p.pct_of_total}%)`));
  console.log("keywords present:", !!data.keywords);
  if (data.keywords) {
    console.log(`  ${data.keywords.ranking_count} / ${data.keywords.tracked_count} ranking`);
    console.log("  avg rank:", data.keywords.avg_rank);
    console.log("  total search volume:", data.keywords.total_search_volume);
    console.log("  movers up:", data.keywords.top_movers_up);
    console.log("  movers down:", data.keywords.top_movers_down);
  }
})();
