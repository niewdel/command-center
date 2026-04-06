import ical from "node-ical";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type SyncResult = {
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
};

function extractMeetingUrl(
  text: string | undefined | null
): { url: string; provider: "zoom" | "teams" | "google_meet" | "other" } | null {
  if (!text) return null;
  const zoom = text.match(/https:\/\/[a-z0-9-]*\.?zoom\.us\/j\/\S+/i);
  if (zoom) return { url: zoom[0], provider: "zoom" };
  const teams = text.match(/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/\S+/i);
  if (teams) return { url: teams[0], provider: "teams" };
  const meet = text.match(/https:\/\/meet\.google\.com\/\S+/i);
  if (meet) return { url: meet[0], provider: "google_meet" };
  return null;
}

export async function syncIcsFeed(connectionId: string): Promise<SyncResult> {
  const supabase = getSupabaseAdmin();
  const result: SyncResult = { added: 0, updated: 0, deleted: 0, errors: [] };

  // Fetch connection details
  const { data: connection, error: connError } = await supabase
    .from("calendar_connections")
    .select("*")
    .eq("id", connectionId)
    .single();

  if (connError || !connection?.feed_url) {
    result.errors.push("Connection not found or no feed URL");
    return result;
  }

  // Fetch and parse ICS feed
  let events: ical.CalendarResponse;
  try {
    events = await ical.async.fromURL(connection.feed_url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Failed to fetch ICS feed: ${msg}`);
    return result;
  }

  // Define sync window: 30 days back, 90 days forward
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 30);
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 90);

  const source = connection.provider as "google" | "microsoft" | "apple";
  const seenExternalIds = new Set<string>();

  for (const [, component] of Object.entries(events)) {
    if (!component || component.type !== "VEVENT") continue;
    const event = component as ical.VEvent;

    const uid = event.uid;
    if (!uid) continue;

    const startDate = event.start ? new Date(event.start.toString()) : null;
    const endDate = event.end ? new Date(event.end.toString()) : null;

    if (!startDate || !endDate) continue;

    // Skip events outside sync window
    if (endDate < windowStart || startDate > windowEnd) continue;

    seenExternalIds.add(uid);

    const isAllDay =
      event.datetype === "date" ||
      (startDate.getHours() === 0 &&
        startDate.getMinutes() === 0 &&
        endDate.getHours() === 0 &&
        endDate.getMinutes() === 0 &&
        endDate.getTime() - startDate.getTime() >= 86400000);

    const description = typeof event.description === "string" ? event.description : null;
    const location = typeof event.location === "string" ? event.location : null;
    const meetingInfo = extractMeetingUrl(description) || extractMeetingUrl(location);

    // Parse attendees
    const attendees: { email: string; name?: string; status?: string }[] = [];
    if (event.attendee) {
      const attendeeList = Array.isArray(event.attendee)
        ? event.attendee
        : [event.attendee];
      for (const att of attendeeList) {
        if (typeof att === "object" && att.val) {
          const email = att.val.replace("mailto:", "").trim();
          if (email) {
            attendees.push({
              email,
              name: att.params?.CN || undefined,
              status: att.params?.PARTSTAT || undefined,
            });
          }
        }
      }
    }

    const eventData = {
      user_id: connection.user_id,
      connection_id: connectionId,
      external_id: uid,
      title: event.summary || "Untitled Event",
      description,
      location,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      all_day: isAllDay,
      timezone: connection.provider === "microsoft" ? "America/New_York" : "America/New_York",
      status: (event.status?.toLowerCase() === "tentative" ? "tentative" : "confirmed") as
        | "confirmed"
        | "tentative",
      meeting_url: meetingInfo?.url || null,
      meeting_provider: meetingInfo?.provider || null,
      attendees,
      color: connection.color,
      source,
      is_read_only: true,
      updated_at: new Date().toISOString(),
    };

    // Upsert: use connection_id + external_id unique constraint
    const { data: existing } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("connection_id", connectionId)
      .eq("external_id", uid)
      .single();

    if (existing) {
      await supabase
        .from("calendar_events")
        .update(eventData)
        .eq("id", existing.id);
      result.updated++;
    } else {
      await supabase.from("calendar_events").insert(eventData);
      result.added++;
    }
  }

  // Delete events no longer in feed (within sync window)
  const { data: localEvents } = await supabase
    .from("calendar_events")
    .select("id, external_id")
    .eq("connection_id", connectionId)
    .gte("start_time", windowStart.toISOString())
    .lte("start_time", windowEnd.toISOString());

  if (localEvents) {
    for (const local of localEvents) {
      if (local.external_id && !seenExternalIds.has(local.external_id)) {
        await supabase.from("calendar_events").delete().eq("id", local.id);
        result.deleted++;
      }
    }
  }

  // Update last_synced_at
  await supabase
    .from("calendar_connections")
    .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", connectionId);

  return result;
}
