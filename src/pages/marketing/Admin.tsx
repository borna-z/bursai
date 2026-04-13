 import { useState, useEffect } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { Helmet } from 'react-helmet-async';
 import { Download, Search, BarChart3, Users, Eye } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { useLanguage } from '@/contexts/LanguageContext';
 import { motion, useReducedMotion } from 'framer-motion';
 import { hapticLight } from '@/lib/haptics';
 import { EASE_CURVE } from '@/lib/motion';
 import { PageHeader } from '@/components/layout/PageHeader';
 import { AppLayout } from '@/components/layout/AppLayout';

 interface Lead {
   id: string;
   email: string;
   source: string | null;
   utm_source: string | null;
   utm_medium: string | null;
   utm_content: string | null;
   utm_campaign: string | null;
   created_at: string;
 }

 interface EventCount {
   event_name: string;
   count: number;
 }

 export default function Admin() {
   const navigate = useNavigate();
   const { user } = useAuth();
   const { t } = useLanguage();
   const prefersReduced = useReducedMotion();
   const [isAuthorized, setIsAuthorized] = useState(false);
   const [leads, setLeads] = useState<Lead[]>([]);
   const [eventCounts, setEventCounts] = useState<EventCount[]>([]);
   const [searchQuery, setSearchQuery] = useState('');
   const [isLoading, setIsLoading] = useState(true);

   useEffect(() => {
     checkAdminAccess();
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [user]);

   const checkAdminAccess = async () => {
     if (!user) {
       navigate('/auth');
       return;
     }

     const { data } = await supabase
       .from('user_roles')
       .select('role')
       .eq('user_id', user.id)
       .eq('role', 'admin')
       .single();

     if (!data) {
       navigate('/');
       return;
     }

     setIsAuthorized(true);
     await Promise.all([fetchLeads(), fetchEventCounts()]);
     setIsLoading(false);
   };

   const fetchLeads = async () => {
    const { data } = await supabase
      .from('marketing_leads')
      .select('*')
      .order('created_at', { ascending: false });

     if (data) setLeads(data);
   };

   const fetchEventCounts = async () => {
    const { data } = await supabase
      .from('marketing_events')
      .select('event_name');

     if (data) {
       const counts: Record<string, number> = {};
       data.forEach((event: { event_name: string }) => {
         counts[event.event_name] = (counts[event.event_name] || 0) + 1;
       });

       setEventCounts(
         Object.entries(counts).map(([event_name, count]) => ({
           event_name,
           count,
         }))
       );
     }
   };

   const filteredLeads = leads.filter(lead =>
     lead.email.toLowerCase().includes(searchQuery.toLowerCase())
   );

   const exportCSV = () => {
     hapticLight();
     const headers = ['Email', 'Source', 'UTM Source', 'UTM Campaign', 'Created At'];
     const rows = filteredLeads.map(lead => [
       lead.email,
       lead.source,
       lead.utm_source || '',
       lead.utm_campaign || '',
       lead.created_at,
     ]);

     const csv = [headers, ...rows]
       .map(row => row.map(cell => `"${cell}"`).join(','))
       .join('\n');

     const blob = new Blob([csv], { type: 'text/csv' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
     a.click();
   };

   const motionProps = (i: number) =>
     prefersReduced ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.08 * i, duration: 0.35, ease: EASE_CURVE } };

   if (!isAuthorized || isLoading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-pulse text-muted-foreground font-body">Loading...</div>
       </div>
     );
   }

   const totalPageViews = eventCounts.find(e => e.event_name === 'page_view')?.count || 0;
   const totalLeads = leads.length;
   const totalClicks = eventCounts.find(e => e.event_name === 'cta_open_app_click')?.count || 0;

   return (
     <>
       <Helmet>
         <title>Admin | BURS</title>
         <meta name="robots" content="noindex, nofollow" />
       </Helmet>

       <AppLayout>
         <PageHeader eyebrow="System Overview" title="Admin" showBack />

         <div className="max-w-6xl mx-auto px-4 pt-6 pb-24 space-y-6">
           {/* KPI metrics strip */}
           <motion.div className="grid grid-cols-3 gap-3" {...motionProps(0)}>
             <div className="rounded-[1.25rem] p-4 text-center space-y-1 border border-border/40">
               <Eye className="w-4 h-4 mx-auto text-muted-foreground/50" />
               <p className="text-2xl font-semibold tracking-tight">{totalPageViews}</p>
               <p className="text-[10px] font-body uppercase tracking-[0.14em] text-muted-foreground/60">{t('admin.page_views')}</p>
             </div>
             <div className="rounded-[1.25rem] p-4 text-center space-y-1 border border-border/40">
               <Users className="w-4 h-4 mx-auto text-muted-foreground/50" />
               <p className="text-2xl font-semibold tracking-tight">{totalLeads}</p>
               <p className="text-[10px] font-body uppercase tracking-[0.14em] text-muted-foreground/60">{t('admin.leads')}</p>
             </div>
             <div className="rounded-[1.25rem] p-4 text-center space-y-1 border border-border/40">
               <BarChart3 className="w-4 h-4 mx-auto text-muted-foreground/50" />
               <p className="text-2xl font-semibold tracking-tight">{totalClicks}</p>
               <p className="text-[10px] font-body uppercase tracking-[0.14em] text-muted-foreground/60">{t('admin.app_clicks')}</p>
             </div>
           </motion.div>

           {/* Events breakdown */}
           <motion.div className="rounded-[1.25rem] p-5 space-y-4 border border-border/40" {...motionProps(1)}>
             <h2 className="font-display italic text-[1.15rem]">{t('admin.events')}</h2>
             <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
               {eventCounts.map(event => (
                 <div key={event.event_name} className="flex justify-between items-center px-4 py-3 rounded-[1rem] bg-background/60">
                   <span className="text-sm font-body font-medium">{event.event_name}</span>
                   <span className="text-sm text-muted-foreground tabular-nums">{event.count}</span>
                 </div>
               ))}
             </div>
           </motion.div>

           {/* Leads table */}
           <motion.div className="rounded-[1.25rem] p-5 space-y-4 border border-border/40" {...motionProps(2)}>
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
               <h2 className="font-display italic text-[1.15rem]">{t('admin.leads')} ({filteredLeads.length})</h2>
               <div className="flex gap-2">
                 <div className="relative flex-1 sm:w-64">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                   <Input
                     placeholder={t('admin.search_email')}
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="pl-9 rounded-full"
                   />
                 </div>
                 <Button variant="outline" className="rounded-full" onClick={exportCSV}>
                   <Download className="w-4 h-4 mr-2" />
                   CSV
                 </Button>
               </div>
             </div>
             <div className="overflow-x-auto -mx-5">
               <table className="w-full text-sm font-body">
                 <thead>
                   <tr className="border-b border-border/60">
                     <th className="text-left py-3 px-5 font-medium text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">{t('admin.email')}</th>
                     <th className="text-left py-3 px-5 font-medium text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">{t('admin.source')}</th>
                     <th className="text-left py-3 px-5 font-medium text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">{t('admin.utm')}</th>
                     <th className="text-left py-3 px-5 font-medium text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">{t('admin.date')}</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filteredLeads.map(lead => (
                     <tr key={lead.id} className="border-b border-border/40">
                       <td className="py-3 px-5 font-medium">{lead.email}</td>
                       <td className="py-3 px-5 text-muted-foreground">{lead.source}</td>
                       <td className="py-3 px-5 text-muted-foreground">
                         {lead.utm_source || '-'}
                       </td>
                       <td className="py-3 px-5 text-muted-foreground tabular-nums">
                         {new Date(lead.created_at).toLocaleDateString(undefined)}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>

               {filteredLeads.length === 0 && (
                 <p className="text-center py-12 text-muted-foreground font-body">
                   {t('admin.no_leads')}
                 </p>
               )}
             </div>
           </motion.div>
         </div>
       </AppLayout>
     </>
   );
 }
