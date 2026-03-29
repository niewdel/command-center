import { createClient } from "@supabase/supabase-js";
import { EmailConnection } from "@/types/database";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getValidToken(connection: EmailConnection): Promise<string> {
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at)
    : null;

  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  // Token is still valid
  if (expiresAt && expiresAt > fiveMinutesFromNow) {
    return connection.access_token;
  }

  // Token expired or expiring soon -- refresh it
  if (!connection.refresh_token) {
    await markConnectionInactive(connection.id);
    throw new Error(`No refresh token available for connection ${connection.id}`);
  }

  const refreshUrl =
    connection.provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : "https://login.microsoftonline.com/common/oauth2/v2.0/token";

  const clientId =
    connection.provider === "google"
      ? process.env.GOOGLE_CLIENT_ID!
      : process.env.MICROSOFT_CLIENT_ID!;

  const clientSecret =
    connection.provider === "google"
      ? process.env.GOOGLE_CLIENT_SECRET!
      : process.env.MICROSOFT_CLIENT_SECRET!;

  try {
    const response = await fetch(refreshUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connection.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Token refresh failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json();

    const newAccessToken: string = data.access_token;
    const newRefreshToken: string | null = data.refresh_token ?? connection.refresh_token;
    const expiresIn: number = data.expires_in ?? 3600;
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const supabase = getSupabaseAdmin();
    const { error: updateError } = await supabase
      .from("email_connections")
      .update({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    if (updateError) {
      console.error("Failed to update tokens in database:", updateError);
    }

    return newAccessToken;
  } catch (error) {
    await markConnectionInactive(connection.id);
    throw error;
  }
}

async function markConnectionInactive(connectionId: string) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("email_connections")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);
}
