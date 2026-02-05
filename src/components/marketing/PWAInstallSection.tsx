 import { forwardRef, useState, useEffect } from 'react';
 import { Smartphone, Check, Apple, Chrome } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { MARKETING_CONFIG } from '@/config/marketing';
 import { trackMarketingEvent } from '@/lib/marketingAnalytics';
 import { cn } from '@/lib/utils';
 
 interface BeforeInstallPromptEvent extends Event {
   prompt(): Promise<void>;
   userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
 }
 
 export const PWAInstallSection = forwardRef<HTMLElement>((_, ref) => {
   const { pwaInstall } = MARKETING_CONFIG;
   const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
   const [isInstalled, setIsInstalled] = useState(false);
 
   useEffect(() => {
     const handler = (e: Event) => {
       e.preventDefault();
       setDeferredPrompt(e as BeforeInstallPromptEvent);
     };
 
     window.addEventListener('beforeinstallprompt', handler);
 
     // Check if already installed
     if (window.matchMedia('(display-mode: standalone)').matches) {
       setIsInstalled(true);
     }
 
     return () => window.removeEventListener('beforeinstallprompt', handler);
   }, []);
 
   const handleInstall = async () => {
     if (!deferredPrompt) return;
 
     trackMarketingEvent('cta_install_click', { method: 'native' });
     
     await deferredPrompt.prompt();
     const { outcome } = await deferredPrompt.userChoice;
     
     if (outcome === 'accepted') {
       setIsInstalled(true);
     }
     
     setDeferredPrompt(null);
   };
 
   return (
     <section ref={ref} id="install" className="py-16 md:py-24 bg-muted/30">
       <div className="max-w-4xl mx-auto px-4">
         {/* Section header */}
         <div className="text-center mb-12">
           <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
             <Smartphone className="w-8 h-8 text-primary" />
           </div>
           <h2 className="text-2xl md:text-3xl font-bold mb-3">
             {pwaInstall.headline}
           </h2>
           <p className="text-muted-foreground">
             {pwaInstall.subheadline}
           </p>
         </div>
 
         {/* Install cards */}
         <div className="grid md:grid-cols-2 gap-6">
           {/* iPhone instructions */}
           <div className="bg-card rounded-2xl p-6 border border-border/50">
             <div className="flex items-center gap-3 mb-6">
               <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center">
                 <Apple className="w-5 h-5" />
               </div>
               <h3 className="font-semibold">{pwaInstall.iphoneTitle}</h3>
             </div>
             
             <ol className="space-y-3">
               {pwaInstall.iphoneSteps.map((step, index) => (
                 <li key={index} className="flex items-start gap-3">
                   <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-medium text-primary">
                     {index + 1}
                   </span>
                   <span className="text-sm text-muted-foreground pt-0.5">{step}</span>
                 </li>
               ))}
             </ol>
           </div>
 
           {/* Android instructions */}
           <div className="bg-card rounded-2xl p-6 border border-border/50">
             <div className="flex items-center gap-3 mb-6">
               <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center">
                 <Chrome className="w-5 h-5" />
               </div>
               <h3 className="font-semibold">{pwaInstall.androidTitle}</h3>
             </div>
             
             {deferredPrompt && !isInstalled ? (
               <Button
                 onClick={handleInstall}
                 className="w-full h-12 font-semibold"
               >
                 {pwaInstall.androidButton}
               </Button>
             ) : isInstalled ? (
               <div className="flex items-center gap-2 text-success p-3 bg-success/10 rounded-lg">
                 <Check className="w-5 h-5" />
                 <span className="text-sm font-medium">Appen är installerad</span>
               </div>
             ) : (
               <ol className="space-y-3">
                 {pwaInstall.androidFallbackSteps.map((step, index) => (
                   <li key={index} className="flex items-start gap-3">
                     <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-medium text-primary">
                       {index + 1}
                     </span>
                     <span className="text-sm text-muted-foreground pt-0.5">{step}</span>
                   </li>
                 ))}
               </ol>
             )}
           </div>
         </div>
       </div>
     </section>
   );
 });
 
 PWAInstallSection.displayName = 'PWAInstallSection';