 import { Link } from 'react-router-dom';
 import { ArrowRight } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { MARKETING_CONFIG } from '@/config/marketing';
 import { trackMarketingEvent } from '@/lib/marketingAnalytics';
 
 interface FinalCTASectionProps {
   installSectionRef: React.RefObject<HTMLElement>;
 }
 
 export function FinalCTASection({ installSectionRef }: FinalCTASectionProps) {
   const { finalCta } = MARKETING_CONFIG;
 
   const scrollToInstall = () => {
     trackMarketingEvent('cta_install_click');
     installSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
   };
 
   return (
     <section className="py-20 md:py-28">
       <div className="max-w-4xl mx-auto px-4 text-center">
         {/* Background glow */}
         <div className="relative">
           <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 rounded-3xl blur-3xl -z-10" />
           
           <div className="bg-card border border-border/50 rounded-3xl p-10 md:p-16">
             {/* Headline */}
             <h2 className="text-3xl md:text-4xl font-bold mb-8 leading-tight">
               {finalCta.headline}
             </h2>
             
             {/* CTAs */}
             <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <Button
                 asChild
                 size="lg"
                 className="h-14 px-8 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                 onClick={() => trackMarketingEvent('cta_open_app_click')}
               >
                 <Link to={MARKETING_CONFIG.appUrl}>
                   {finalCta.primaryCta}
                   <ArrowRight className="ml-2 w-5 h-5" />
                 </Link>
               </Button>
               
               <Button
                 variant="outline"
                 size="lg"
                 className="h-14 px-8 text-base font-medium hover:bg-muted/50 transition-all duration-300"
                 onClick={scrollToInstall}
               >
                 {finalCta.secondaryCta}
               </Button>
             </div>
           </div>
         </div>
       </div>
     </section>
   );
 }