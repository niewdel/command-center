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
  rrule: string | null;
  exdates: Date[];
  recurrenceId: string | null;
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

// Map common TZID values to UTC offset in minutes
// Outlook uses Windows timezone names, Google uses IANA
function getTimezoneOffsetMinutes(tzid: string, date: Date): number | null {
  const month = date.getMonth(); // 0-11
  // Rough DST: March-November for US timezones
  const isDST = month >= 2 && month <= 10;

  const tz = tzid.toLowerCase().replace(/\s+/g, " ");

  // Eastern
  if (tz.includes("eastern") || tz.includes("america/new_york") || tz.includes("us/eastern") || tz.includes("est")) {
    return isDST ? -240 : -300; // EDT: -4h, EST: -5h
  }
  // Central
  if (tz.includes("central") || tz.includes("america/chicago") || tz.includes("us/central") || tz.includes("cst")) {
    return isDST ? -300 : -360;
  }
  // Mountain
  if (tz.includes("mountain") || tz.includes("america/denver") || tz.includes("us/mountain") || tz.includes("mst")) {
    return isDST ? -360 : -420;
  }
  // Pacific
  if (tz.includes("pacific") || tz.includes("america/los_angeles") || tz.includes("us/pacific") || tz.includes("pst")) {
    return isDST ? -420 : -480;
  }
  // UTC/GMT
  if (tz === "utc" || tz === "gmt" || tz.includes("utc")) {
    return 0;
  }
  return null;
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
    const year = parseInt(yr);
    const month = parseInt(mo) - 1;
    const day = parseInt(dy);
    const hour = parseInt(hr);
    const minute = parseInt(mn);
    const second = parseInt(sc);

    if (z === "Z") {
      // Explicit UTC
      return {
        date: new Date(Date.UTC(year, month, day, hour, minute, second)),
        isDate: false,
      };
    }

    // Has timezone — convert to UTC using offset
    if (tzid) {
      const tempDate = new Date(year, month, day); // just for DST check
      const offsetMinutes = getTimezoneOffsetMinutes(tzid, tempDate);
      if (offsetMinutes !== null) {
        // Create UTC date by subtracting the timezone offset
        // If event is at 2pm Eastern (UTC-5), that's 7pm UTC = 14:00 - (-300min) = 14:00 + 300min in UTC
        return {
          date: new Date(Date.UTC(year, month, day, hour, minute - offsetMinutes, second)),
          isDate: false,
        };
      }
    }

    // No timezone info — assume America/New_York (Justin's timezone)
    const localDate = new Date(year, month, day);
    const isDST = localDate.getMonth() >= 2 && localDate.getMonth() <= 10;
    const estOffset = isDST ? -240 : -300;
    return {
      date: new Date(Date.UTC(year, month, day, hour, minute - estOffset, second)),
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

// RRULE expansion: generate occurrences within a date window
function expandRecurringEvents(
  events: ParsedEvent[],
  windowStart: Date,
  windowEnd: Date
): ParsedEvent[] {
  const expanded: ParsedEvent[] = [];
  // Collect recurrence overrides (RECURRENCE-ID events replace a specific instance)
  const overrides = new Map<string, Set<string>>();
  for (const event of events) {
    if (event.recurrenceId) {
      const key = event.uid;
      if (!overrides.has(key)) overrides.set(key, new Set());
      overrides.get(key)!.add(event.recurrenceId);
    }
  }

  for (const event of events) {
    // Events with RECURRENCE-ID are overrides — add them directly
    if (event.recurrenceId) {
      expanded.push(event);
      continue;
    }

    // Non-recurring: add as-is
    if (!event.rrule) {
      expanded.push(event);
      continue;
    }

    // Parse RRULE
    const rule = parseRRule(event.rrule);
    if (!rule) {
      expanded.push(event); // Can't parse — add original
      continue;
    }

    const duration = event.endDate.getTime() - event.startDate.getTime();
    const exdateSet = new Set(event.exdates.map((d) => d.toISOString().split("T")[0]));
    const overrideSet = overrides.get(event.uid);
    const maxInstances = 365; // Safety limit
    let count = 0;

    let cursor = new Date(event.startDate);

    while (cursor <= windowEnd && count < maxInstances) {
      if (rule.until && cursor > rule.until) break;
      if (rule.count !== null && count >= rule.count) break;

      const instanceStart = new Date(cursor);
      const instanceEnd = new Date(cursor.getTime() + duration);
      const dateKey = instanceStart.toISOString().split("T")[0];

      // Check if within window and not excluded
      if (
        instanceEnd > windowStart &&
        instanceStart <= windowEnd &&
        !exdateSet.has(dateKey)
      ) {
        // Check if this instance is overridden
        const overrideKey = cursor.toISOString().replace(".000Z", "Z");
        const isOverridden = overrideSet?.has(overrideKey);

        if (!isOverridden) {
          expanded.push({
            ...event,
            uid: `${event.uid}_${dateKey}`,
            startDate: instanceStart,
            endDate: instanceEnd,
            rrule: null, // Mark expanded instances as non-recurring
          });
        }
      }

      // Advance cursor
      cursor = advanceCursor(cursor, rule);
      count++;
    }
  }

  return expanded;
}

type RRule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  until: Date | null;
  count: number | null;
  byday: string[];
  bymonthday: number[];
};

const DAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

function parseRRule(rrule: string): RRule | null {
  const parts = rrule.split(";");
  const map: Record<string, string> = {};
  for (const part of parts) {
    const [key, val] = part.split("=");
    if (key && val) map[key] = val;
  }

  const freq = map.FREQ as RRule["freq"];
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;

  return {
    freq,
    interval: map.INTERVAL ? parseInt(map.INTERVAL) : 1,
    until: map.UNTIL ? parseIcsDate(map.UNTIL).date : null,
    count: map.COUNT ? parseInt(map.COUNT) : null,
    byday: map.BYDAY ? map.BYDAY.split(",") : [],
    bymonthday: map.BYMONTHDAY ? map.BYMONTHDAY.split(",").map(Number) : [],
  };
}

function advanceCursor(date: Date, rule: RRule): Date {
  const next = new Date(date);

  switch (rule.freq) {
    case "DAILY":
      next.setDate(next.getDate() + rule.interval);
      break;

    case "WEEKLY":
      if (rule.byday.length > 0) {
        // Find next matching day
        const currentDay = next.getDay();
        const targetDays = rule.byday.map((d) => DAY_MAP[d]).filter((d) => d !== undefined).sort((a, b) => a - b);

        if (targetDays.length === 0) {
          next.setDate(next.getDate() + 7 * rule.interval);
          break;
        }

        // Find next day in the same week or next cycle
        const nextInWeek = targetDays.find((d) => d > currentDay);
        if (nextInWeek !== undefined) {
          next.setDate(next.getDate() + (nextInWeek - currentDay));
        } else {
          // Jump to first day of next interval week
          const daysUntilNextWeek = 7 * rule.interval - currentDay + targetDays[0];
          next.setDate(next.getDate() + daysUntilNextWeek);
        }
      } else {
        next.setDate(next.getDate() + 7 * rule.interval);
      }
      break;

    case "MONTHLY":
      if (rule.bymonthday.length > 0) {
        // Try next month day in current month, else next month
        const currentMonthDay = next.getDate();
        const nextDay = rule.bymonthday.find((d) => d > currentMonthDay);
        if (nextDay) {
          next.setDate(nextDay);
        } else {
          next.setMonth(next.getMonth() + rule.interval);
          next.setDate(rule.bymonthday[0]);
        }
      } else {
        next.setMonth(next.getMonth() + rule.interval);
      }
      break;

    case "YEARLY":
      next.setFullYear(next.getFullYear() + rule.interval);
      break;
  }

  return next;
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
    rawRrule?: string;
    rawExdates?: string[];
    rawRecurrenceId?: string;
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

        const exdates = (currentEvent.rawExdates || []).map((d) => parseIcsDate(d).date);

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
          rrule: currentEvent.rawRrule || null,
          exdates,
          recurrenceId: currentEvent.rawRecurrenceId || null,
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
      case "RRULE":
        currentEvent.rawRrule = value;
        break;
      case "EXDATE": {
        // EXDATE can have multiple dates comma-separated
        const dates = value.split(",").map((d) => d.trim()).filter(Boolean);
        if (!currentEvent.rawExdates) currentEvent.rawExdates = [];
        currentEvent.rawExdates.push(...dates);
        break;
      }
      case "RECURRENCE-ID":
        currentEvent.rawRecurrenceId = value;
        break;
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
  const rawEvents = parseIcsFeed(icsText);

  // Define sync window: 30 days back, 90 days forward
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 30);
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 90);

  // Expand recurring events into individual instances
  const events = expandRecurringEvents(rawEvents, windowStart, windowEnd);

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
