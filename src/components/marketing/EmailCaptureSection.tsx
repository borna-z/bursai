 import { useState } from 'react';
 import { Mail, Check, Loader2 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { MARKETING_CONFIG } from '@/config/marketing';
 import { submitMarketingLead } from '@/lib/marketingAnalytics';
 import { cn } from '@/lib/utils';
 
 export function EmailCaptureSection() {
   const { emailCapture } = MARKETING_CONFIG;
   const [email, setEmail] = useState('');
   const [honeypot, setHoneypot] = useState('');
   const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'duplicate'>('idle');
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     // Honeypot check
     if (honeypot) return;
     
     // Basic email validation
     if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
     
     setStatus('loading');
     
     const result = await submitMarketingLead(email);
     
     if (result.success) {
       setStatus('success');
       setEmail('');
     } else if (result.error === 'duplicate') {
       setStatus('duplicate');
     } else {
       setStatus('error');
     }
   };
 
   return (
     <section className="py-16 md:py-24">
       <div className="max-w-xl mx-auto px-4 text-center">
         {/* Icon */}
         <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
           <Mail className="w-7 h-7 text-primary" />
         </div>
         
         {/* Headline */}
         <h2 className="text-2xl md:text-3xl font-bold mb-8">
           {emailCapture.headline}
         </h2>
         
         {/* Form */}
         {status === 'success' ? (
           <div className="flex items-center justify-center gap-3 p-4 bg-success/10 text-success rounded-xl animate-fade-in">
             <Check className="w-5 h-5" />
             <span className="font-medium">{emailCapture.successMessage}</span>
           </div>
         ) : (
           <form onSubmit={handleSubmit} className="space-y-4">
             <div className="flex flex-col sm:flex-row gap-3">
               <Input
                 type="email"
                 placeholder={emailCapture.placeholder}
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 className="h-12 px-4 flex-1"
                 required
               />
               
               {/* Honeypot field - hidden from users */}
               <input
                 type="text"
                 name="website"
                 value={honeypot}
                 onChange={(e) => setHoneypot(e.target.value)}
                 className="hidden"
                 tabIndex={-1}
                 autoComplete="off"
               />
               
               <Button
                 type="submit"
                 className="h-12 px-6 font-semibold min-w-[140px]"
                 disabled={status === 'loading'}
               >
                 {status === 'loading' ? (
                   <Loader2 className="w-5 h-5 animate-spin" />
                 ) : (
                   emailCapture.button
                 )}
               </Button>
             </div>
             
             {status === 'error' && (
               <p className="text-sm text-destructive animate-fade-in">
                 {emailCapture.errorMessage}
               </p>
             )}
             
             {status === 'duplicate' && (
               <p className="text-sm text-muted-foreground animate-fade-in">
                 {emailCapture.duplicateMessage}
               </p>
             )}
           </form>
         )}
       </div>
     </section>
   );
 }