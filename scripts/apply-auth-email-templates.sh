#!/usr/bin/env bash
# Apply branded Supabase Auth email templates (supabase/templates/*.html) to
# the live project via the Management API.
#
# Requires: SUPABASE_ACCESS_TOKEN (from `supabase login`, token at
# ~/.supabase/access-token, or exported directly) and jq.
#
# Optional: set RESEND_API_KEY to also switch auth email sending to custom
# SMTP via Resend, so emails come from noreply@niewdel.com instead of
# noreply@mail.app.supabase.io.
set -euo pipefail

PROJECT_REF="mrnuwlxmzxzhqadhktef"
DIR="$(cd "$(dirname "$0")/../supabase/templates" && pwd)"

TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f "$HOME/.supabase/access-token" ]; then
  TOKEN="$(cat "$HOME/.supabase/access-token")"
fi
if [ -z "$TOKEN" ]; then
  echo "No SUPABASE_ACCESS_TOKEN. Run: supabase login" >&2
  exit 1
fi

payload=$(jq -n \
  --rawfile recovery "$DIR/recovery.html" \
  --rawfile invite "$DIR/invite.html" \
  --rawfile magic "$DIR/magic_link.html" \
  --rawfile confirm "$DIR/confirmation.html" \
  --rawfile change "$DIR/email_change.html" \
  '{
    mailer_subjects_recovery: "Reset your Niewdel password",
    mailer_subjects_invite: "You are invited to your Niewdel workspace",
    mailer_subjects_magic_link: "Your Niewdel sign-in link",
    mailer_subjects_confirmation: "Confirm your email",
    mailer_subjects_email_change: "Confirm your new email",
    mailer_templates_recovery_content: $recovery,
    mailer_templates_invite_content: $invite,
    mailer_templates_magic_link_content: $magic,
    mailer_templates_confirmation_content: $confirm,
    mailer_templates_email_change_content: $change
  }')

if [ -n "${RESEND_API_KEY:-}" ]; then
  payload=$(echo "$payload" | jq \
    --arg pass "$RESEND_API_KEY" \
    '. + {
      smtp_admin_email: "noreply@niewdel.com",
      smtp_sender_name: "Niewdel",
      smtp_host: "smtp.resend.com",
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: $pass
    }')
  echo "Including Resend SMTP config (sender: noreply@niewdel.com)"
fi

curl -sf -X PATCH \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$payload" \
  | jq '{mailer_subjects_recovery, smtp_host, smtp_admin_email}'

echo "Applied. Send yourself a reset email to verify."
