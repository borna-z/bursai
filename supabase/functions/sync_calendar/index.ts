import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SSRF protection
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
      return { blocked: true, reason: 'Endast http/https tillåtet' };
    }
    const hostname = url.hostname.toLowerCase();
    if (BLOCKED_HOSTS.includes(hostname)) {
      return { blocked: true, reason: 'Lokal adress blockerad' };
    }
    for (const prefix of BLOCKED_IP_PREFIXES) {
      if (hostname.startsWith(prefix)) {
        return { blocked: true, reason: 'Privat IP-adress blockerad' };
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
        return { blocked: true, reason: 'Intern IP-adress blockerad' };
      }
    }
    return { blocked: false };
  } catch {
    return { blocked: true, reason: 'Ogiltig URL' };
  }
}

interface CalendarEvent {
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  provider: string;
}

// Parse ICS date format (YYYYMMDD or YYYYMMDDTHHmmssZ)
function parseICSDate(dateStr: string): { date: string; time: string | null } {
  // Remove any timezone identifier like TZID=...
  const cleanStr = dateStr.replace(/^TZID=[^:]+:/, '');
  
  // Full datetime format: YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ
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
  
  // Date only format: YYYYMMDD
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
    // Handle line folding (lines starting with space/tab are continuations)
    if (line.startsWith(' ') || line.startsWith('\t')) {
      currentValue += line.slice(1);
      continue;
    }
    
    // Process previous key-value pair
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
    
    // Parse new key-value pair
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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Ej autentiserad' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Ogiltig autentisering' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile with ICS URL
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('ics_url')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Kunde inte hämta profil' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile?.ics_url) {
      return new Response(
        JSON.stringify({ error: 'Ingen kalender-URL konfigurerad', synced: 0, upcoming: 0 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SSRF validation
    const ssrfCheck = isBlockedUrl(profile.ics_url);
    if (ssrfCheck.blocked) {
      return new Response(
        JSON.stringify({ error: ssrfCheck.reason || 'Ogiltig kalender-URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch ICS data from user's URL
    console.log('Fetching ICS from:', profile.ics_url.substring(0, 50) + '...');
    
    const icsResponse = await fetch(profile.ics_url, {
      headers: {
        'User-Agent': 'GarderobsAssistent/1.0',
      },
    });

    if (!icsResponse.ok) {
      console.error('ICS fetch failed:', icsResponse.status, icsResponse.statusText);
      return new Response(
        JSON.stringify({ error: 'Kunde inte hämta kalenderdata. Kontrollera URL:en.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const icsContent = await icsResponse.text();
    
    // Validate it looks like ICS content
    if (!icsContent.includes('BEGIN:VCALENDAR')) {
      return new Response(
        JSON.stringify({ error: 'Ogiltig ICS-fil. Kontrollera att URL:en pekar på en kalender.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and filter events
    const allEvents = parseICS(icsContent);
    const upcomingEvents = filterUpcomingEvents(allEvents);

    console.log(`Parsed ${allEvents.length} events, ${upcomingEvents.length} upcoming`);

    // Delete old events for this user (only upcoming dates)
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('calendar_events')
      .delete()
      .eq('user_id', user.id)
      .gte('date', today);

    // Insert new events
    if (upcomingEvents.length > 0) {
      const eventsToInsert = upcomingEvents.map(event => ({
        user_id: user.id,
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
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Kunde inte spara kalenderhändelser' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update last sync timestamp
    await supabase
      .from('profiles')
      .update({ last_calendar_sync: new Date().toISOString() })
      .eq('id', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        synced: upcomingEvents.length,
        upcoming: upcomingEvents.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync calendar error:', error);
    return new Response(
      JSON.stringify({ error: 'Ett oväntat fel uppstod' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
