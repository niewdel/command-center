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

type ParsedEvent = {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  status: string | null;
  attendees: { email: string; name?: string; status?: string }[];
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

// Unfold ICS lines (lines starting with space/tab are continuations)
function unfoldLines(text: string): string[] {
  return text.replace(/\r\n[ \t]/g, "").replace(/\r/g, "").split("\n");
}

// Parse ICS date formats: 20260406T140000Z or 20260406T140000 or 20260406
function parseIcsDate(value: string, tzid?: string): { date: Date; isDate: boolean } {
  const clean = value.trim();

  // Date only: YYYYMMDD
  if (/^\d{8}$/.test(clean)) {
    const y = parseInt(clean.slice(0, 4));
    const m = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    return { date: new Date(y, m, d), isDate: true };
  }

  // DateTime: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (match) {
    const [, yr, mo, dy, hr, mn, sc, z] = match;
    if (z === "Z") {
      return {
        date: new Date(
          Date.UTC(
            parseInt(yr),
            parseInt(mo) - 1,
            parseInt(dy),
            parseInt(hr),
            parseInt(mn),
            parseInt(sc)
          )
        ),
        isDate: false,
      };
    }
    // No Z — treat as local time (or use tzid if provided, but for simplicity use local)
    return {
      date: new Date(
        parseInt(yr),
        parseInt(mo) - 1,
        parseInt(dy),
        parseInt(hr),
        parseInt(mn),
        parseInt(sc)
      ),
      isDate: false,
    };
  }

  // Fallback
  return { date: new Date(clean), isDate: false };
}

// Unescape ICS text values
function unescapeIcs(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcsFeed(icsText: string): ParsedEvent[] {
  const lines = unfoldLines(icsText);
  const events: ParsedEvent[] = [];

  let inEvent = false;
  let currentEvent: Partial<ParsedEvent> & {
    dtstart?: string;
    dtend?: string;
    dtstartTzid?: string;
    dtendTzid?: string;
    dtstartIsDate?: boolean;
  } = {};
  let attendeesList: { email: string; name?: string; status?: string }[] = [];

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      currentEvent = {};
      attendeesList = [];
      continue;
    }

    if (line === "END:VEVENT") {
      inEvent = false;

      if (currentEvent.uid && currentEvent.dtstart) {
        const start = parseIcsDate(currentEvent.dtstart, currentEvent.dtstartTzid);
        let end: { date: Date; isDate: boolean };

        if (currentEvent.dtend) {
          end = parseIcsDate(currentEvent.dtend, currentEvent.dtendTzid);
        } else {
          // Default: 1 hour for timed events, 1 day for all-day
          const endDate = new Date(start.date);
          if (start.isDate) {
            endDate.setDate(endDate.getDate() + 1);
          } else {
            endDate.setHours(endDate.getHours() + 1);
          }
          end = { date: endDate, isDate: start.isDate };
        }

        events.push({
          uid: currentEvent.uid,
          summary: currentEvent.summary || "Untitled Event",
          description: currentEvent.description || null,
          location: currentEvent.location || null,
          startDate: start.date,
          endDate: end.date,
          isAllDay: start.isDate || currentEvent.dtstartIsDate || false,
          status: currentEvent.status || null,
          attendees: attendeesList,
        });
      }
      continue;
    }

    if (!inEvent) continue;

    // Parse property
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const propPart = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);

    // Extract property name and params
    const semiIdx = propPart.indexOf(";");
    const propName = semiIdx === -1 ? propPart : propPart.slice(0, semiIdx);
    const params = semiIdx === -1 ? "" : propPart.slice(semiIdx + 1);

    switch (propName) {
      case "UID":
        currentEvent.uid = value;
        break;
      case "SUMMARY":
        currentEvent.summary = unescapeIcs(value);
        break;
      case "DESCRIPTION":
        currentEvent.description = unescapeIcs(value);
        break;
      case "LOCATION":
        currentEvent.location = unescapeIcs(value);
        break;
      case "STATUS":
        currentEvent.status = value;
        break;
      case "DTSTART": {
        currentEvent.dtstart = value;
        const tzMatch = params.match(/TZID=([^;]+)/);
        if (tzMatch) currentEvent.dtstartTzid = tzMatch[1];
        if (params.includes("VALUE=DATE")) currentEvent.dtstartIsDate = true;
        break;
      }
      case "DTEND": {
        currentEvent.dtend = value;
        const tzMatch = params.match(/TZID=([^;]+)/);
        if (tzMatch) currentEvent.dtendTzid = tzMatch[1];
        break;
      }
      case "ATTENDEE": {
        const email = value.replace("mailto:", "").trim();
        const cnMatch = params.match(/CN=([^;]+)/);
        const statusMatch = params.match(/PARTSTAT=([^;]+)/);
        if (email) {
          attendeesList.push({
            email,
            name: cnMatch ? cnMatch[1].replace(/^"|"$/g, "") : undefined,
            status: statusMatch ? statusMatch[1] : undefined,
          });
        }
        break;
      }
    }
  }

  return events;
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

  // Fetch ICS feed
  let icsText: string;
  try {
    const res = await fetch(connection.feed_url, {
      headers: { "User-Agent": "CommandCenter/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    icsText = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Failed to fetch ICS feed: ${msg}`);
    return result;
  }

  // Parse events
  const events = parseIcsFeed(icsText);

  // Define sync window: 30 days back, 90 days forward
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 30);
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 90);

  const source = connection.provider as "google" | "microsoft" | "apple";
  const seenExternalIds = new Set<string>();

  for (const event of events) {
    // Skip events outside sync window
    if (event.endDate < windowStart || event.startDate > windowEnd) continue;

    seenExternalIds.add(event.uid);

    const meetingInfo =
      extractMeetingUrl(event.description) || extractMeetingUrl(event.location);

    const eventData = {
      user_id: connection.user_id,
      workspace_id: connection.workspace_id || null,
      connection_id: connectionId,
      external_id: event.uid,
      title: event.summary,
      description: event.description,
      location: event.location,
      start_time: event.startDate.toISOString(),
      end_time: event.endDate.toISOString(),
      all_day: event.isAllDay,
      timezone: "America/New_York",
      status: (event.status?.toLowerCase() === "tentative"
        ? "tentative"
        : "confirmed") as "confirmed" | "tentative",
      meeting_url: meetingInfo?.url || null,
      meeting_provider: meetingInfo?.provider || null,
      attendees: event.attendees,
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
      .eq("external_id", event.uid)
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
    .update({
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  return result;
}
