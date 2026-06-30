// Unified email sender for SEO reports + digests.
//
// Prefers Gmail API (sends from the user's actual Workspace address with
// their own SPF/DKIM/DMARC). Falls back to Resend if:
//   - the user hasn't granted gmail.send yet (legacy OAuth connections), OR
//   - Gmail send fails for any reason
//
// Callers pass workspace_id; we resolve to the workspace owner's user_id and
// use that for the Gmail send. If no owner / no google connection, Resend
// kicks in (which sends from the SEO_DIGEST_FROM env address).

import { getWorkspaceOwner } from "./db";
import { sendGmail, GmailScopeMissingError } from "@/lib/google/gmail";
import { sendEmail as sendResend, isEmailConfigured } from "@/lib/email/resend";
import { getConnection } from "@/lib/google/oauth";

interface SendReportArgs {
  workspace_id: string;
  to: string;
  subject: string;
  html: string;
  reply_to?: string;
  from_name?: string;
  // Set to false on internal/test sends to skip the agency-owner BCC.
  // Default true: every outbound client email auto-BCCs the workspace
  // owner so the operator sees what their clients see.
  bcc_owner?: boolean;
}

// Report email policy (no exceptions):
//   - From is ALWAYS noreply@niewdel.com, regardless of send path.
//   - info@ and sales@ are ALWAYS copied (BCC, so clients never see them).
//   - Reply-To points at a monitored mailbox so "just reply" still works
//     even though the From is an unmonitored noreply address.
// Delivery FROM noreply@niewdel.com requires either (a) noreply@niewdel.com
// configured as a Gmail "send-as" alias on the connected Workspace account,
// or (b) a verified niewdel.com domain in Resend. Without one of those the
// send will fail rather than silently fall back to a personal address.
const REPORT_FROM = "noreply@niewdel.com";
const REPORT_REPLY_TO = "info@niewdel.com";
const INTERNAL_RECIPIENTS = ["info@niewdel.com", "sales@niewdel.com"];

interface SendResult {
  ok: boolean;
  via: "gmail" | "resend" | "none";
  message_id?: string;
  error?: string;
}

export async function sendReportEmail(args: SendReportArgs): Promise<SendResult> {
  // Resolve workspace owner once — used to determine the BCC target AND
  // as the user_id for Gmail send. Owner email is fetched from their
  // google_oauth_connections row when available.
  const ownerId = await getWorkspaceOwner(args.workspace_id);
  let ownerEmail: string | null = null;
  if (ownerId) {
    try {
      const conn = await getConnection(ownerId);
      ownerEmail = conn?.google_email ?? null;
    } catch {
      // ignore — BCC is best-effort
    }
  }

  // Build the BCC list:
  //   - info@ and sales@ are ALWAYS copied on outbound reports (no exceptions).
  //   - the workspace owner is copied unless they're the To address
  //     (e.g. when the operator IS the client's contact_email — Niewdel)
  //     or the caller opted out via bcc_owner: false.
  // Skip any address that equals the To so we never double-send.
  const toLower = args.to.toLowerCase();
  const bccOwner = args.bcc_owner !== false;
  const bccSet = new Set<string>();
  for (const addr of INTERNAL_RECIPIENTS) {
    if (addr.toLowerCase() !== toLower) bccSet.add(addr);
  }
  if (
    bccOwner &&
    ownerEmail &&
    ownerEmail.toLowerCase() !== toLower &&
    !INTERNAL_RECIPIENTS.some((a) => a.toLowerCase() === ownerEmail!.toLowerCase())
  ) {
    bccSet.add(ownerEmail);
  }
  const bcc = bccSet.size > 0 ? [...bccSet] : undefined;

  // Resend is the PRIMARY path for reports. The niewdel.com domain is
  // verified in Resend, so it sends from noreply@niewdel.com exactly as set
  // and delivers to any recipient. Gmail is only a fallback, because it
  // sends from the connected personal mailbox and may silently rewrite the
  // From unless noreply@ is a configured send-as alias — which would break
  // the "always from noreply@" rule.
  let resendError: string | null = null;
  if (isEmailConfigured()) {
    try {
      const result = await sendResend({
        from: REPORT_FROM,
        to: args.to,
        bcc,
        subject: args.subject,
        html: args.html,
        replyTo: args.reply_to ?? REPORT_REPLY_TO,
      });
      return { ok: true, via: "resend", message_id: result.id };
    } catch (err) {
      resendError = err instanceof Error ? err.message : String(err);
      console.warn("[send-report] Resend failed, trying Gmail:", resendError);
    }
  }

  // Gmail fallback.
  try {
    if (ownerId) {
      const result = await sendGmail({
        user_id: ownerId,
        from: REPORT_FROM,
        to: args.to,
        bcc,
        subject: args.subject,
        html: args.html,
        reply_to: args.reply_to ?? REPORT_REPLY_TO,
        from_name: args.from_name,
      });
      return { ok: true, via: "gmail", message_id: result.id };
    }
  } catch (err) {
    if (!(err instanceof GmailScopeMissingError)) {
      console.warn(
        "[send-report] Gmail fallback also failed:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return {
    ok: false,
    via: "none",
    error: resendError ?? "Neither Resend nor Gmail is configured",
  };
}
