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

  // Build the BCC list: owner email, but only if it's not already the To
  // (e.g. when the operator IS the client's contact_email — Niewdel) and
  // the caller hasn't opted out via bcc_owner: false.
  const bccOwner = args.bcc_owner !== false;
  const bcc =
    bccOwner &&
    ownerEmail &&
    ownerEmail.toLowerCase() !== args.to.toLowerCase()
      ? [ownerEmail]
      : undefined;

  // Try Gmail first.
  try {
    if (ownerId) {
      const result = await sendGmail({
        user_id: ownerId,
        to: args.to,
        bcc,
        subject: args.subject,
        html: args.html,
        reply_to: args.reply_to,
        from_name: args.from_name,
      });
      return { ok: true, via: "gmail", message_id: result.id };
    }
  } catch (err) {
    if (!(err instanceof GmailScopeMissingError)) {
      console.warn(
        "[send-report] Gmail send failed, falling back to Resend:",
        err instanceof Error ? err.message : String(err)
      );
    }
    // Fall through to Resend
  }

  // Resend fallback.
  if (!isEmailConfigured()) {
    return {
      ok: false,
      via: "none",
      error: "Neither Gmail nor Resend is configured",
    };
  }
  try {
    const result = await sendResend({
      to: args.to,
      bcc,
      subject: args.subject,
      html: args.html,
      replyTo: args.reply_to,
    });
    return { ok: true, via: "resend", message_id: result.id };
  } catch (err) {
    return {
      ok: false,
      via: "resend",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
