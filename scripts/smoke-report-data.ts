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
})();
