 import { useState } from 'react';
 import { Camera, Sparkles, Calendar, BarChart3 } from 'lucide-react';
 import { MARKETING_CONFIG } from '@/config/marketing';
 import { trackMarketingEvent } from '@/lib/marketingAnalytics';
 import { cn } from '@/lib/utils';
 
 const iconMap = {
   camera: Camera,
   sparkles: Sparkles,
   calendar: Calendar,
   chart: BarChart3,
 };
 
 export function ProductDemoSection() {
   const { demo } = MARKETING_CONFIG;
   const [activeStep, setActiveStep] = useState(0);
 
   const handleStepClick = (index: number) => {
     setActiveStep(index);
     trackMarketingEvent('demo_step_click', { step: demo.steps[index].id });
   };
 
   return (
     <section className="py-16 md:py-24">
       <div className="max-w-6xl mx-auto px-4">
         {/* Section headline */}
         <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 md:mb-16">
           {demo.headline}
         </h2>
         
         <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
           {/* Phone mockup */}
           <div className="relative order-2 md:order-1">
             <div className="relative mx-auto w-[280px] md:w-[320px]">
               {/* Phone frame */}
               <div className="relative bg-foreground rounded-[3rem] p-3 shadow-2xl">
                 {/* Screen */}
                 <div className="relative bg-background rounded-[2.5rem] overflow-hidden aspect-[9/19]">
                   {/* Status bar */}
                   <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-foreground/5 to-transparent z-10" />
                   
                   {/* Dynamic content based on step */}
                   <div className="absolute inset-0 flex items-center justify-center p-8">
                     <div className="text-center animate-fade-in" key={activeStep}>
                       {(() => {
                         const step = demo.steps[activeStep];
                         const Icon = iconMap[step.icon as keyof typeof iconMap];
                         return (
                           <>
                             <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
                               <Icon className="w-10 h-10 text-primary" />
                             </div>
                             <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                             <p className="text-sm text-muted-foreground">{step.description}</p>
                           </>
                         );
                       })()}
                     </div>
                   </div>
                   
                   {/* Home indicator */}
                   <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-foreground/20 rounded-full" />
                 </div>
               </div>
               
               {/* Glow effect */}
               <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent rounded-full blur-3xl -z-10" />
             </div>
           </div>
           
           {/* Steps */}
           <div className="order-1 md:order-2 space-y-4">
             {demo.steps.map((step, index) => {
               const Icon = iconMap[step.icon as keyof typeof iconMap];
               const isActive = index === activeStep;
               
               return (
                 <button
                   key={step.id}
                   onClick={() => handleStepClick(index)}
                   className={cn(
                     'w-full text-left p-5 rounded-xl border transition-all duration-300',
                     isActive
                       ? 'bg-primary/5 border-primary/20 shadow-sm'
                       : 'bg-card border-border/50 hover:border-border hover:bg-muted/30'
                   )}
                 >
                   <div className="flex items-start gap-4">
                     <div
                       className={cn(
                         'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                         isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                       )}
                     >
                       <Icon className="w-5 h-5" />
                     </div>
                     <div>
                       <div className="flex items-center gap-2 mb-1">
                         <span className="text-xs font-medium text-muted-foreground">Steg {index + 1}</span>
                       </div>
                       <h3 className="font-semibold mb-1">{step.title}</h3>
                       <p className="text-sm text-muted-foreground">{step.description}</p>
                     </div>
                   </div>
                 </button>
               );
             })}
           </div>
         </div>
       </div>
     </section>
   );
 }