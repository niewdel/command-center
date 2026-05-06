// scripts/smoke-report-print-token.ts
import { signPrintToken, verifyPrintToken, signViewToken, verifyViewToken } from "../src/lib/seo/report-print-token";

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

const v1 = signViewToken(cid);
assert(verifyViewToken(cid, v1), "valid view token must verify");
assert(!verifyViewToken("other", v1), "wrong client must fail view");
assert(!verifyViewToken(cid, "x".repeat(64)), "wrong token must fail view");
assert(!verifyViewToken(cid, "short"), "short token must fail view");
// View tokens have no time bucket — same input always produces same output.
const v2 = signViewToken(cid);
assert(v1 === v2, "view tokens are deterministic for the same client");
// View token must NOT validate as print token (different scope).
assert(!verifyPrintToken(cid, "30d", v1), "view token must not pass print verification");

console.log("OK report-print-token smoke");
