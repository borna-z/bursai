/**
 * Unified calendar Edge Function.
 *
 * Routes via `action` field in request body:
 *   "sync_ics"    — sync a single user's ICS calendar (auth required)
 *   "sync_google" — sync a single user's Google Calendar (auth required)
 *
 * Note: a third `"sync_all"` cron route was removed on 2026-04-25 (P2 finding).
 * It had no caller in-repo and zero pg_cron schedules referenced it for the
 * full 7-day audit window — confirmed dead code. The dispatcher now returns
 * 400 for `action: "sync_all"` (falls through to the default "Unknown action").
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse } from "../_shared/scale-guard.ts";

// ─── SSRF protection ──────────────────────────────────────────
const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
const BLOCKED_IP_PREFIXES = [
  '10.', '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
  '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
  '172.30.', '172.31.', '192.168.', '169.254.', '100.64.',
];

function isBlockedUrl(urlString: string): { blocked: boolean; reason?: string } {
  try {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { blocked: true, reason: 'Only http/https allowed' };
    }
    const hostname = url.hostname.toLowerCase();
    if (BLOCKED_HOSTS.includes(hostname)) {
      return { blocked: true, reason: 'Local address blocked' };
    }
    for (const prefix of BLOCKED_IP_PREFIXES) {
      if (hostname.startsWith(prefix)) {
        return { blocked: true, reason: 'Private IP blocked' };
      }
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      const parts = hostname.split('.').map(Number);
      if (parts[0] === 10 ||
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
          (parts[0] === 192 && parts[1] === 168) ||
          (parts[0] === 169 && parts[1] === 254) ||
          parts[0] === 127 ||
          (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)) {
        return { blocked: true, reason: 'Internal IP blocked' };
      }
    }
    return { blocked: false };
  } catch {
    return { blocked: true, reason: 'Invalid URL' };
  }
}

// ─── ICS parsing ──────────────────────────────────────────────
interface CalendarEvent {
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  provider: string;
}

function parseICSDate(dateStr: string): { date: string; time: string | null } {
  const cleanStr = dateStr.replace(/^TZID=[^:]+:/, '');
  if (cleanStr.includes('T')) {
    const match = cleanStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
    }
  }
  const match = cleanStr.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return { date: `${year}-${month}-${day}`, time: null };
  }
  return { date: '', time: null };
}

function parseICS(icsContent: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = icsContent.split(/\r?\n/);
  let inEvent = false;
  let currentEvent: Partial<CalendarEvent> = {};
  let currentKey = '';
  let currentValue = '';

  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      currentValue += line.slice(1);
      continue;
    }
    if (currentKey && inEvent) {
      if (currentKey === 'SUMMARY') {
        currentEvent.title = currentValue
          .replace(/\\,/g, ',').replace(/\\;/g, ';')
          .replace(/\\n/g, ' ').replace(/\\/g, '');
      } else if (currentKey === 'DTSTART' || currentKey.startsWith('DTSTART;')) {
        const parsed = parseICSDate(currentValue);
        currentEvent.date = parsed.date;
        currentEvent.start_time = parsed.time;
      } else if (currentKey === 'DTEND' || currentKey.startsWith('DTEND;')) {
        currentEvent.end_time = parseICSDate(currentValue).time;
      }
    }
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    currentKey = line.slice(0, colonIndex);
    currentValue = line.slice(colonIndex + 1);
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = { provider: 'ics' };
    } else if (line === 'END:VEVENT') {
      if (currentEvent.title && currentEvent.date) events.push(currentEvent as CalendarEvent);
      inEvent = false;
      currentEvent = {};
    }
  }
  return events;
}

function filterUpcomingEvents(events: CalendarEvent[]): CalendarEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 14);
  return events.filter(e => {
    const d = new Date(e.date);
    return d >= today && d <= maxDate;
  });
}

// ─── Google Calendar helpers ──────────────────────────────────
interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

function parseGoogleEvent(event: GoogleEvent): {
  title: string; description: string | null;
  date: string; start_time: string | null; end_time: string | null;
} | null {
  if (!event.summary) return null;
  let date: string;
  let startTime: string | null = null;
  let endTime: string | null = null;

  if (event.start?.dateTime) {
    const dt = new Date(event.start.dateTime);
    date = dt.toISOString().split('T')[0];
    startTime = dt.toTimeString().slice(0, 5);
  } else if (event.start?.date) {
    date = event.start.date;
  } else {
    return null;
  }
  if (event.end?.dateTime) {
    endTime = new Date(event.end.dateTime).toTimeString().slice(0, 5);
  }
  return { title: event.summary, description: event.description || null, date, start_time: startTime, end_time: endTime };
}

async function refreshAccessToken(
  refreshToken: string, clientId: string, clientSecret: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: clientId,
      client_secret: clientSecret, grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) {
    console.error('Token refresh failed:', await response.text());
    return null;
  }
  return await response.json();
}

// ─── Shared sync routines ─────────────────────────────────────

/** Sync a single user's ICS calendar */
// NOTE: `supabase: any` because `ReturnType<typeof createClient>` now infers a
// strict generic signature (`SupabaseClient<unknown, ..., never, never, ...>`)
// since a recent @supabase/supabase-js bump, which narrows every `.from()`
// chain return to `never` and breaks `.insert(rows)` / `.update(...)` typings.
// The function body uses untyped chains, so `any` preserves prior runtime
// behaviour without forcing the whole file onto generated Database types.
async function syncIcsForUser(
  supabase: any,
  userId: string,
  icsUrl: string
): Promise<{ success: boolean; synced: number; error?: string }> {
  try {
    const ssrfCheck = isBlockedUrl(icsUrl);
    if (ssrfCheck.blocked) return { success: false, synced: 0, error: `SSRF blocked: ${ssrfCheck.reason}` };

    const icsResponse = await fetch(icsUrl, { headers: { 'User-Agent': 'BURS/1.0' } });
    if (!icsResponse.ok) return { success: false, synced: 0, error: `HTTP ${icsResponse.status}` };

    const icsContent = await icsResponse.text();
    if (!icsContent.includes('BEGIN:VCALENDAR')) return { success: false, synced: 0, error: 'Invalid ICS content' };

    const upcomingEvents = filterUpcomingEvents(parseICS(icsContent));
    const today = new Date().toISOString().split('T')[0];

    await supabase.from('calendar_events').delete().eq('user_id', userId).gte('date', today);

    if (upcomingEvents.length > 0) {
      const eventsToInsert = upcomingEvents.map(e => ({
        user_id: userId, title: e.title, date: e.date,
        start_time: e.start_time, end_time: e.end_time, provider: e.provider,
      }));
      const { error: insertError } = await supabase.from('calendar_events').insert(eventsToInsert);
      if (insertError) return { success: false, synced: 0, error: insertError.message };
    }

    await supabase.from('profiles').update({ last_calendar_sync: new Date().toISOString() }).eq('id', userId);
    return { success: true, synced: upcomingEvents.length };
  } catch (error) {
    return { success: false, synced: 0, error: String(error) };
  }
}

/** Sync a single user's Google Calendar */
const GOOGLE_SYNC_WINDOW_DAYS = 30;
const GOOGLE_MAX_RESULTS = 250;

async function syncGoogleForUser(
  // See syncIcsForUser note above — same supabase-js generic narrowing fix.
  supabase: any,
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  tokenExpiresAt: string | null,
  connectionId: string
): Promise<{ success: boolean; synced: number; calendarsSynced: number; syncWindowDays: number; error?: string; reconnect?: boolean }> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
  let currentToken = accessToken;

  if (tokenExpiresAt && new Date(tokenExpiresAt) < new Date() && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken, clientId, clientSecret);
    if (!refreshed) {
      console.error(`Token refresh failed for user ${userId.substring(0, 8)}, deleting stale connection`);
      await supabase.from('calendar_connections').delete().eq('id', connectionId);
      return { success: false, synced: 0, calendarsSynced: 0, syncWindowDays: GOOGLE_SYNC_WINDOW_DAYS, error: 'reconnect_required', reconnect: true };
    }
    currentToken = refreshed.access_token;
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabase.from('calendar_connections').update({ access_token: currentToken, token_expires_at: newExpiry }).eq('id', connectionId);
  }

  const now = new Date();
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + GOOGLE_SYNC_WINDOW_DAYS);

  const params = new URLSearchParams({
    timeMin: now.toISOString(), timeMax: maxDate.toISOString(),
    singleEvents: 'true', orderBy: 'startTime', maxResults: String(GOOGLE_MAX_RESULTS),
  });

  const apiResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${currentToken}` } }
  );

  if (!apiResponse.ok) {
    const errText = await apiResponse.text();
    console.error(`Google primary calendar events error for user ${userId.substring(0, 8)}:`, errText);
    return { success: false, synced: 0, calendarsSynced: 0, syncWindowDays: GOOGLE_SYNC_WINDOW_DAYS, error: `Google API ${apiResponse.status}` };
  }

  const apiData = await apiResponse.json();
  const parsedEvents: Array<{
    title: string;
    description: string | null;
    date: string;
    start_time: string | null;
    end_time: string | null;
  }> = ((apiData.items || []) as GoogleEvent[])
    .map(parseGoogleEvent)
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const dedupedEvents = Array.from(new Map(
    parsedEvents.map((event) => [`${event.title}|${event.date}|${event.start_time ?? ''}|${event.end_time ?? ''}`, event])
  ).values());

  const today = now.toISOString().split('T')[0];
  await supabase.from('calendar_events').delete().eq('user_id', userId).eq('provider', 'google').gte('date', today);

  if (dedupedEvents.length > 0) {
    const eventsToInsert = dedupedEvents.map(e => ({
      user_id: userId, title: e.title, description: e.description,
      date: e.date, start_time: e.start_time, end_time: e.end_time, provider: 'google',
    }));
    const { error: insertError } = await supabase.from('calendar_events').insert(eventsToInsert);
    if (insertError) return { success: false, synced: 0, calendarsSynced: 1, syncWindowDays: GOOGLE_SYNC_WINDOW_DAYS, error: insertError.message };
  }

  await supabase.from('profiles').update({ last_calendar_sync: new Date().toISOString() }).eq('id', userId);
  return { success: true, synced: dedupedEvents.length, calendarsSynced: 1, syncWindowDays: GOOGLE_SYNC_WINDOW_DAYS };
}

// ─── Auth helpers ─────────────────────────────────────────────

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function getAuthenticatedUser(
  // See syncIcsForUser note — same supabase-js generic narrowing fix.
  supabase: any,
): Promise<string | Response> {
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) {
    return jsonResponse({ error: 'Invalid auth' }, 401);
  }
  return userData.user.id;
}

// ─── Action handlers ──────────────────────────────────────────

async function handleSyncIcs(authHeader: string): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const userOrError = await getAuthenticatedUser(supabase);
  if (typeof userOrError !== 'string') return userOrError;
  const userId = userOrError;

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  await enforceRateLimit(serviceClient, userId, "calendar");

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('ics_url').eq('id', userId).single();

  if (profileError) return jsonResponse({ error: 'Could not fetch profile' }, 500);
  if (!profile?.ics_url) return jsonResponse({ error: 'No calendar URL configured', synced: 0, upcoming: 0 }, 400);

  const result = await syncIcsForUser(supabase, userId, profile.ics_url);
  if (!result.success) return jsonResponse({ error: result.error }, 500);
  return jsonResponse({ success: true, synced: result.synced, upcoming: result.synced });
}

async function handleSyncGoogle(authHeader: string): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const userOrError = await getAuthenticatedUser(supabase);
  if (typeof userOrError !== 'string') return userOrError;
  const userId = userOrError;

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  await enforceRateLimit(adminClient, userId, "calendar");

  const { data: connection, error: connError } = await supabase
    .from('calendar_connections').select('*')
    .eq('user_id', userId).eq('provider', 'google').single();

  if (connError || !connection) {
    return jsonResponse({ error: 'No Google Calendar connection found' }, 400);
  }

  const result = await syncGoogleForUser(
    adminClient, userId,
    connection.access_token, connection.refresh_token,
    connection.token_expires_at, connection.id
  );

  if (!result.success) {
    const status = result.reconnect ? 401 : 500;
    return jsonResponse({ error: result.error, reconnect: result.reconnect || false }, status);
  }
  return jsonResponse({ success: true, synced: result.synced, calendarsSynced: result.calendarsSynced, syncWindowDays: result.syncWindowDays });
}

// ─── Main handler ─────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (checkOverload("calendar")) {
    return overloadResponse(CORS_HEADERS);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    let action = 'sync_ics'; // default
    try {
      const body = await req.json();
      if (body?.action) action = body.action;
    } catch {
      // no body — default to sync_ics
    }

    switch (action) {
      case 'sync_ics':
        return await handleSyncIcs(authHeader);
      case 'sync_google':
        return await handleSyncGoogle(authHeader);
      default:
        // Note: `sync_all` was removed on 2026-04-25 (P2 finding — dead code).
        // It now falls through here and returns 400.
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    if (error instanceof RateLimitError) {
      return rateLimitResponse(error, CORS_HEADERS);
    }
    console.error('Calendar function error:', error);
    return jsonResponse({ error: 'An unexpected error occurred' }, 500);
  }
});
