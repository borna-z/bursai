import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalendarEvent {
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  provider: string;
}

// Parse ICS date format (YYYYMMDD or YYYYMMDDTHHmmssZ)
function parseICSDate(dateStr: string): { date: string; time: string | null } {
  const cleanStr = dateStr.replace(/^TZID=[^:]+:/, '');
  
  if (cleanStr.includes('T')) {
    const match = cleanStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      return {
        date: `${year}-${month}-${day}`,
        time: `${hour}:${minute}`,
      };
    }
  }
  
  const match = cleanStr.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return {
      date: `${year}-${month}-${day}`,
      time: null,
    };
  }
  
  return { date: '', time: null };
}

// Parse ICS content and extract VEVENT components
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
          .replace(/\\,/g, ',')
          .replace(/\\;/g, ';')
          .replace(/\\n/g, ' ')
          .replace(/\\/g, '');
      } else if (currentKey === 'DTSTART' || currentKey.startsWith('DTSTART;')) {
        const parsed = parseICSDate(currentValue);
        currentEvent.date = parsed.date;
        currentEvent.start_time = parsed.time;
      } else if (currentKey === 'DTEND' || currentKey.startsWith('DTEND;')) {
        const parsed = parseICSDate(currentValue);
        currentEvent.end_time = parsed.time;
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
      if (currentEvent.title && currentEvent.date) {
        events.push(currentEvent as CalendarEvent);
      }
      inEvent = false;
      currentEvent = {};
    }
  }
  
  return events;
}

// Filter events to only include upcoming ones (next 14 days)
function filterUpcomingEvents(events: CalendarEvent[]): CalendarEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 14);
  
  return events.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate >= today && eventDate <= maxDate;
  });
}

// Sync calendar for a single user
async function syncUserCalendar(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  icsUrl: string
): Promise<{ success: boolean; synced: number; error?: string }> {
  try {
    console.log(`Syncing calendar for user ${userId.substring(0, 8)}...`);
    
    const icsResponse = await fetch(icsUrl, {
      headers: { 'User-Agent': 'GarderobsAssistent/1.0' },
    });

    if (!icsResponse.ok) {
      return { success: false, synced: 0, error: `HTTP ${icsResponse.status}` };
    }

    const icsContent = await icsResponse.text();
    
    if (!icsContent.includes('BEGIN:VCALENDAR')) {
      return { success: false, synced: 0, error: 'Invalid ICS content' };
    }

    const allEvents = parseICS(icsContent);
    const upcomingEvents = filterUpcomingEvents(allEvents);

    // Delete old events for this user
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('calendar_events')
      .delete()
      .eq('user_id', userId)
      .gte('date', today);

    // Insert new events
    if (upcomingEvents.length > 0) {
      const eventsToInsert = upcomingEvents.map(event => ({
        user_id: userId,
        title: event.title,
        date: event.date,
        start_time: event.start_time,
        end_time: event.end_time,
        provider: event.provider,
      }));

      const { error: insertError } = await supabase
        .from('calendar_events')
        .insert(eventsToInsert);

      if (insertError) {
        return { success: false, synced: 0, error: insertError.message };
      }
    }

    // Update last sync timestamp
    await supabase
      .from('profiles')
      .update({ last_calendar_sync: new Date().toISOString() })
      .eq('id', userId);

    return { success: true, synced: upcomingEvents.length };
  } catch (error) {
    return { success: false, synced: 0, error: String(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This function is called by cron, validate with service role
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Verify the request is from cron (uses anon key) or has valid service role
    const expectedAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const providedKey = authHeader?.replace('Bearer ', '');
    
    if (providedKey !== expectedAnonKey && providedKey !== serviceRoleKey) {
      console.log('Unauthorized request to sync_all_calendars');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to access all users
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all users with ics_url configured
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, ics_url')
      .not('ics_url', 'is', null);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profiles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profiles || profiles.length === 0) {
      console.log('No users with calendar configured');
      return new Response(
        JSON.stringify({ synced_users: 0, total_events: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${profiles.length} users with ICS calendar configured`);

    // Sync ICS users
    let syncedUsers = 0;
    let totalEvents = 0;
    const errors: string[] = [];

    for (const profile of profiles) {
      if (!profile.ics_url) continue;
      
      const result = await syncUserCalendar(supabase, profile.id, profile.ics_url);
      
      if (result.success) {
        syncedUsers++;
        totalEvents += result.synced;
      } else {
        errors.push(`User ${profile.id.substring(0, 8)}: ${result.error}`);
      }
    }

    // --- Sync Google Calendar connections ---
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (clientId && clientSecret) {
      const { data: googleConns, error: gError } = await supabase
        .from('calendar_connections')
        .select('id, user_id, access_token, refresh_token, token_expires_at')
        .eq('provider', 'google');

      if (!gError && googleConns && googleConns.length > 0) {
        console.log(`Found ${googleConns.length} Google Calendar connections`);

        for (const conn of googleConns) {
          try {
            let currentToken = conn.access_token;

            // Refresh token if expired
            if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date() && conn.refresh_token) {
              const refreshResp = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  refresh_token: conn.refresh_token,
                  client_id: clientId,
                  client_secret: clientSecret,
                  grant_type: 'refresh_token',
                }),
              });

              if (refreshResp.ok) {
                const tokenData = await refreshResp.json();
                currentToken = tokenData.access_token;
                const newExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
                await supabase
                  .from('calendar_connections')
                  .update({ access_token: currentToken, token_expires_at: newExpiry })
                  .eq('id', conn.id);
              } else {
                errors.push(`Google user ${conn.user_id.substring(0, 8)}: Token refresh failed`);
                continue;
              }
            }

            // Fetch Google Calendar events
            const now = new Date();
            const maxDate = new Date(now);
            maxDate.setDate(maxDate.getDate() + 14);

            const params = new URLSearchParams({
              timeMin: now.toISOString(),
              timeMax: maxDate.toISOString(),
              singleEvents: 'true',
              orderBy: 'startTime',
              maxResults: '100',
            });

            const apiResp = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
              { headers: { Authorization: `Bearer ${currentToken}` } }
            );

            if (!apiResp.ok) {
              errors.push(`Google user ${conn.user_id.substring(0, 8)}: API ${apiResp.status}`);
              continue;
            }

            const apiData = await apiResp.json();
            const events = (apiData.items || []) as Array<{
              summary?: string;
              description?: string;
              start?: { dateTime?: string; date?: string };
              end?: { dateTime?: string; date?: string };
            }>;

            // Parse events
            const today = now.toISOString().split('T')[0];
            const parsedEvents = events
              .filter(e => e.summary)
              .map(e => {
                let date: string;
                let startTime: string | null = null;
                let endTime: string | null = null;

                if (e.start?.dateTime) {
                  const dt = new Date(e.start.dateTime);
                  date = dt.toISOString().split('T')[0];
                  startTime = dt.toTimeString().slice(0, 5);
                } else if (e.start?.date) {
                  date = e.start.date;
                } else {
                  return null;
                }

                if (e.end?.dateTime) {
                  endTime = new Date(e.end.dateTime).toTimeString().slice(0, 5);
                }

                return {
                  user_id: conn.user_id,
                  title: e.summary!,
                  description: e.description || null,
                  date,
                  start_time: startTime,
                  end_time: endTime,
                  provider: 'google',
                };
              })
              .filter((e): e is NonNullable<typeof e> => e !== null);

            // Delete and re-insert
            await supabase
              .from('calendar_events')
              .delete()
              .eq('user_id', conn.user_id)
              .eq('provider', 'google')
              .gte('date', today);

            if (parsedEvents.length > 0) {
              await supabase.from('calendar_events').insert(parsedEvents);
            }

            await supabase
              .from('profiles')
              .update({ last_calendar_sync: new Date().toISOString() })
              .eq('id', conn.user_id);

            syncedUsers++;
            totalEvents += parsedEvents.length;
          } catch (err) {
            errors.push(`Google user ${conn.user_id.substring(0, 8)}: ${String(err)}`);
          }
        }
      }
    }

    console.log(`Sync complete: ${syncedUsers} users, ${totalEvents} events`);

    return new Response(
      JSON.stringify({
        synced_users: syncedUsers,
        total_users: profiles.length,
        total_events: totalEvents,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync all calendars error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
