 import { Zap, Sparkles, Calendar, Lightbulb, Wand2 } from 'lucide-react';
 import { MARKETING_CONFIG } from '@/config/marketing';
 import { cn } from '@/lib/utils';
 
 const iconMap = {
   zap: Zap,
   sparkles: Sparkles,
   calendar: Calendar,
   lightbulb: Lightbulb,
   wand: Wand2,
 };
 
 export function BenefitsSection() {
   const { benefits } = MARKETING_CONFIG;
 
   return (
     <section className="py-16 md:py-24 bg-muted/30">
       <div className="max-w-6xl mx-auto px-4">
         {/* Section headline */}
         <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 md:mb-16">
           {benefits.headline}
         </h2>
         
         {/* Benefits grid */}
         <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
           {benefits.items.map((item, index) => {
             const Icon = iconMap[item.icon as keyof typeof iconMap];
             
             return (
               <div
                 key={item.title}
                 className={cn(
                   'group relative bg-card rounded-2xl p-6 border border-border/50',
                   'hover:shadow-lg hover:border-primary/20 transition-all duration-300',
                   'animate-fade-in'
                 )}
                 style={{ animationDelay: `${index * 50}ms` }}
               >
                 {/* Icon */}
                 <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-4 group-hover:from-primary/20 group-hover:to-accent/20 transition-colors">
                   <Icon className="w-6 h-6 text-primary" />
                 </div>
                 
                 {/* Content */}
                 <h3 className="font-semibold mb-2">{item.title}</h3>
                 <p className="text-sm text-muted-foreground leading-relaxed">
                   {item.description}
                 </p>
               </div>
             );
           })}
         </div>
       </div>
     </section>
   );
 }