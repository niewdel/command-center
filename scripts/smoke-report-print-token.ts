// scripts/smoke-report-print-token.ts
import { signPrintToken, verifyPrintToken } from "../src/lib/seo/report-print-token";

process.env.SEO_REPORT_PRINT_SECRET = "test-secret-do-not-use-in-prod";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const cid = "00000000-0000-0000-0000-000000000001";

const t1 = signPrintToken(cid, "30d");
assert(verifyPrintToken(cid, "30d", t1), "valid token must verify");
assert(!verifyPrintToken(cid, "90d", t1), "wrong range must fail");
assert(!verifyPrintToken("other", "30d", t1), "wrong client must fail");
assert(!verifyPrintToken(cid, "30d", "x".repeat(64)), "wrong token must fail");
assert(!verifyPrintToken(cid, "30d", "short"), "short token must fail");

console.log("OK report-print-token smoke");
