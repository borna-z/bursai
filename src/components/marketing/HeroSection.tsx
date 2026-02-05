 import { useRef } from 'react';
 import { Link } from 'react-router-dom';
 import { ArrowRight, Shield, Zap, Heart } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { MARKETING_CONFIG } from '@/config/marketing';
 import { trackMarketingEvent } from '@/lib/marketingAnalytics';
 import { cn } from '@/lib/utils';
 
 interface HeroSectionProps {
   installSectionRef: React.RefObject<HTMLElement>;
 }
 
 export function HeroSection({ installSectionRef }: HeroSectionProps) {
   const { hero } = MARKETING_CONFIG;
   
   const scrollToInstall = () => {
     trackMarketingEvent('cta_install_click');
     installSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
   };
 
   const trustIcons = [Shield, Zap, Heart];
 
   return (
     <section className="relative overflow-hidden">
       {/* Background gradient */}
       <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
       
       {/* Subtle pattern overlay */}
       <div 
         className="absolute inset-0 opacity-[0.015]"
         style={{
           backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 1px)`,
           backgroundSize: '32px 32px',
         }}
       />
       
       <div className="relative max-w-6xl mx-auto px-4 pt-24 pb-20 md:pt-32 md:pb-28">
         <div className="max-w-3xl mx-auto text-center">
           {/* Headline */}
           <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 animate-fade-in">
             {hero.headline}
           </h1>
           
           {/* Subheadline */}
           <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto animate-fade-in animation-delay-100">
             {hero.subheadline}
           </p>
           
           {/* CTAs */}
           <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-fade-in animation-delay-200">
             <Button
               asChild
               size="lg"
               className="h-14 px-8 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
               onClick={() => trackMarketingEvent('cta_open_app_click')}
             >
               <Link to={MARKETING_CONFIG.appUrl}>
                 {hero.primaryCta}
                 <ArrowRight className="ml-2 w-5 h-5" />
               </Link>
             </Button>
             
             <Button
               variant="outline"
               size="lg"
               className="h-14 px-8 text-base font-medium hover:bg-muted/50 transition-all duration-300"
               onClick={scrollToInstall}
             >
               {hero.secondaryCta}
             </Button>
           </div>
           
           {/* Trust row */}
           <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground animate-fade-in animation-delay-300">
             {hero.trustItems.map((item, index) => {
               const Icon = trustIcons[index];
               return (
                 <div key={item} className="flex items-center gap-2">
                   <Icon className="w-4 h-4 text-primary/70" />
                   <span>{item}</span>
                 </div>
               );
             })}
           </div>
         </div>
       </div>
     </section>
   );
 }