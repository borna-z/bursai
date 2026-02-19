 import { useState, useEffect } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { Helmet } from 'react-helmet-async';
 import { Download, Search, BarChart3, Users, Eye } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 
 interface Lead {
   id: string;
   email: string;
   source: string;
   utm_source: string | null;
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
   const [isAuthorized, setIsAuthorized] = useState(false);
   const [leads, setLeads] = useState<Lead[]>([]);
   const [eventCounts, setEventCounts] = useState<EventCount[]>([]);
   const [searchQuery, setSearchQuery] = useState('');
   const [isLoading, setIsLoading] = useState(true);
 
   useEffect(() => {
     checkAdminAccess();
   }, [user]);
 
   const checkAdminAccess = async () => {
     if (!user) {
       navigate('/auth');
       return;
     }
 
     // Check if user is admin
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
     const { data } = await (supabase
       .from('marketing_leads') as any)
       .select('*')
       .order('created_at', { ascending: false });
     
     if (data) setLeads(data);
   };
 
   const fetchEventCounts = async () => {
     // Get event counts by grouping
     const { data } = await (supabase
       .from('marketing_events') as any)
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
 
   if (!isAuthorized || isLoading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background">
         <div className="animate-pulse text-muted-foreground">Laddar...</div>
       </div>
     );
   }
 
   const totalPageViews = eventCounts.find(e => e.event_name === 'page_view')?.count || 0;
   const totalLeads = leads.length;
   const totalClicks = eventCounts.find(e => e.event_name === 'cta_open_app_click')?.count || 0;
 
   return (
     <>
       <Helmet>
         <title>Admin | DRAPE</title>
         <meta name="robots" content="noindex, nofollow" />
       </Helmet>
       
       <div className="min-h-screen bg-background p-4 md:p-8">
         <div className="max-w-6xl mx-auto">
           <h1 className="text-2xl font-bold mb-8">Marketing Admin</h1>
           
           {/* Stats cards */}
           <div className="grid sm:grid-cols-3 gap-4 mb-8">
             <Card>
               <CardHeader className="pb-2">
                 <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                   <Eye className="w-4 h-4" />
                   Sidvisningar
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <p className="text-3xl font-bold">{totalPageViews}</p>
               </CardContent>
             </Card>
             
             <Card>
               <CardHeader className="pb-2">
                 <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                   <Users className="w-4 h-4" />
                   Leads
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <p className="text-3xl font-bold">{totalLeads}</p>
               </CardContent>
             </Card>
             
             <Card>
               <CardHeader className="pb-2">
                 <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                   <BarChart3 className="w-4 h-4" />
                   App-klick
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <p className="text-3xl font-bold">{totalClicks}</p>
               </CardContent>
             </Card>
           </div>
           
           {/* Event breakdown */}
           <Card className="mb-8">
             <CardHeader>
               <CardTitle className="text-base">Händelser</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                 {eventCounts.map(event => (
                   <div key={event.event_name} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                     <span className="text-sm font-medium">{event.event_name}</span>
                     <span className="text-sm text-muted-foreground">{event.count}</span>
                   </div>
                 ))}
               </div>
             </CardContent>
           </Card>
           
           {/* Leads table */}
           <Card>
             <CardHeader>
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                 <CardTitle className="text-base">Leads ({filteredLeads.length})</CardTitle>
                 <div className="flex gap-2">
                   <div className="relative flex-1 sm:w-64">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                     <Input
                       placeholder="Sök email..."
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       className="pl-9"
                     />
                   </div>
                   <Button variant="outline" onClick={exportCSV}>
                     <Download className="w-4 h-4 mr-2" />
                     CSV
                   </Button>
                 </div>
               </div>
             </CardHeader>
             <CardContent>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm">
                   <thead>
                     <tr className="border-b">
                       <th className="text-left py-3 px-2 font-medium">Email</th>
                       <th className="text-left py-3 px-2 font-medium">Källa</th>
                       <th className="text-left py-3 px-2 font-medium">UTM</th>
                       <th className="text-left py-3 px-2 font-medium">Datum</th>
                     </tr>
                   </thead>
                   <tbody>
                     {filteredLeads.map(lead => (
                       <tr key={lead.id} className="border-b border-border/50">
                         <td className="py-3 px-2">{lead.email}</td>
                         <td className="py-3 px-2 text-muted-foreground">{lead.source}</td>
                         <td className="py-3 px-2 text-muted-foreground">
                           {lead.utm_source || '-'}
                         </td>
                         <td className="py-3 px-2 text-muted-foreground">
                           {new Date(lead.created_at).toLocaleDateString('sv-SE')}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                 
                 {filteredLeads.length === 0 && (
                   <p className="text-center py-8 text-muted-foreground">
                     Inga leads hittades
                   </p>
                 )}
               </div>
             </CardContent>
           </Card>
         </div>
       </div>
     </>
   );
 }