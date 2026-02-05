 import { supabase } from '@/integrations/supabase/client';
 
 export type MarketingEvent = 
   | 'page_view'
   | 'cta_open_app_click'
   | 'cta_install_click'
   | 'lead_submit'
   | 'faq_open'
   | 'demo_step_click';
 
 function getDeviceType(): string {
   const ua = navigator.userAgent;
   if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
   if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
   return 'desktop';
 }
 
 function getUtmParams() {
   const params = new URLSearchParams(window.location.search);
   return {
     utm_source: params.get('utm_source'),
     utm_campaign: params.get('utm_campaign'),
     utm_medium: params.get('utm_medium'),
   };
 }
 
 export async function trackMarketingEvent(
   eventName: MarketingEvent,
   metadata?: Record<string, unknown>
 ) {
   try {
     const utmParams = getUtmParams();
     
     await (supabase.from('marketing_events') as any).insert({
       event_name: eventName,
       path: window.location.pathname,
       device_type: getDeviceType(),
       utm_source: utmParams.utm_source,
       utm_campaign: utmParams.utm_campaign,
       utm_medium: utmParams.utm_medium,
       metadata: metadata || {},
     });
   } catch (error) {
     // Silent fail - don't break UX for analytics
     console.error('Analytics error:', error);
   }
 }
 
 // Rate limiting for lead submissions (simple in-memory)
 const leadSubmissions = new Map<string, number>();
 const RATE_LIMIT_MS = 60000; // 1 minute
 
 export function isRateLimited(email: string): boolean {
   const lastSubmit = leadSubmissions.get(email);
   if (lastSubmit && Date.now() - lastSubmit < RATE_LIMIT_MS) {
     return true;
   }
   leadSubmissions.set(email, Date.now());
   return false;
 }
 
 export async function submitMarketingLead(email: string): Promise<{ success: boolean; error?: string }> {
   if (isRateLimited(email)) {
     return { success: false, error: 'rate_limited' };
   }
   
   try {
     const params = new URLSearchParams(window.location.search);
     
     const { error } = await (supabase.from('marketing_leads') as any).insert({
       email,
       source: 'website',
       utm_source: params.get('utm_source'),
       utm_medium: params.get('utm_medium'),
       utm_campaign: params.get('utm_campaign'),
       utm_content: params.get('utm_content'),
     });
     
     if (error) {
       if (error.code === '23505') {
         return { success: false, error: 'duplicate' };
       }
       throw error;
     }
     
     await trackMarketingEvent('lead_submit');
     return { success: true };
   } catch (error) {
     console.error('Lead submit error:', error);
     return { success: false, error: 'unknown' };
   }
 }