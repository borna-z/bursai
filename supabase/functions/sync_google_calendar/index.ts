import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Refresh the access token using the refresh token
async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    console.error('Token refresh failed:', await response.text());
    return null;
  }

  return await response.json();
}

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

function parseGoogleEvent(event: GoogleEvent): {
  title: string;
  description: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
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
    const dt = new Date(event.end.dateTime);
    endTime = dt.toTimeString().slice(0, 5);
  }

  return {
    title: event.summary,
    description: event.description || null,
    date,
    start_time: startTime,
    end_time: endTime,
  };
}

// Exported for use by sync_all_calendars
export async function syncGoogleCalendarForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  tokenExpiresAt: string | null,
  connectionId: string
): Promise<{ success: boolean; synced: number; error?: string; reconnect?: boolean }> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

  let currentToken = accessToken;

  // Check if token is expired and refresh
  if (tokenExpiresAt && new Date(tokenExpiresAt) < new Date() && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken, clientId, clientSecret);
    if (!refreshed) {
      // Token revoked or expired — delete stale connection
      console.error(`Token refresh failed for user ${userId.substring(0, 8)}, deleting stale connection`);
      await supabase.from('calendar_connections').delete().eq('id', connectionId);
      return { success: false, synced: 0, error: 'reconnect_required', reconnect: true };
    }
    currentToken = refreshed.access_token;
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    await supabase
      .from('calendar_connections')
      .update({ access_token: currentToken, token_expires_at: newExpiry })
      .eq('id', connectionId);
  }

  // Fetch events from Google Calendar API (next 14 days)
  const now = new Date();
  const timeMin = now.toISOString();
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + 14);
  const timeMax = maxDate.toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });

  const apiResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${currentToken}` } }
  );

  if (!apiResponse.ok) {
    const errText = await apiResponse.text();
    console.error(`Google API error for user ${userId.substring(0, 8)}:`, errText);
    return { success: false, synced: 0, error: `Google API ${apiResponse.status}` };
  }

  const apiData = await apiResponse.json();
  const events = (apiData.items || []) as GoogleEvent[];

  const parsedEvents = events
    .map(parseGoogleEvent)
    .filter((e): e is NonNullable<typeof e> => e !== null);

  // Delete existing google events for this user (upcoming)
  const today = now.toISOString().split('T')[0];
  await supabase
    .from('calendar_events')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'google')
    .gte('date', today);

  // Insert new events
  if (parsedEvents.length > 0) {
    const eventsToInsert = parsedEvents.map(event => ({
      user_id: userId,
      title: event.title,
      description: event.description,
      date: event.date,
      start_time: event.start_time,
      end_time: event.end_time,
      provider: 'google',
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

  return { success: true, synced: parsedEvents.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user = { id: claimsData.claims.sub as string };

    // Get the user's Google Calendar connection
    const { data: connection, error: connError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Ingen Google Calendar-koppling hittades' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for writes
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const result = await syncGoogleCalendarForUser(
      adminClient,
      user.id,
      connection.access_token,
      connection.refresh_token,
      connection.token_expires_at,
      connection.id
    );

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, synced: result.synced }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync Google Calendar error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
