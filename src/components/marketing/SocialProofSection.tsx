 import { Quote } from 'lucide-react';
 import { MARKETING_CONFIG } from '@/config/marketing';
 import { cn } from '@/lib/utils';
 
 export function SocialProofSection() {
   const { socialProof } = MARKETING_CONFIG;
 
   return (
     <section className="py-16 md:py-24 bg-muted/30">
       <div className="max-w-6xl mx-auto px-4">
         {/* Section headline */}
         <p className="text-center text-muted-foreground mb-12 md:mb-16 max-w-xl mx-auto">
           {socialProof.headline}
         </p>
         
         {/* Testimonials grid */}
         <div className="grid md:grid-cols-3 gap-6 md:gap-8">
           {socialProof.testimonials.map((testimonial, index) => (
             <div
               key={index}
               className={cn(
                 'relative bg-card rounded-2xl p-6 md:p-8 shadow-sm border border-border/50',
                 'hover:shadow-md hover:border-border transition-all duration-300',
                 'animate-fade-in'
               )}
               style={{ animationDelay: `${index * 100}ms` }}
             >
               <Quote className="absolute top-6 right-6 w-8 h-8 text-primary/10" />
               
               <p className="text-foreground leading-relaxed mb-6">
                 "{testimonial.quote}"
               </p>
               
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                   <span className="text-sm font-semibold text-primary">
                     {testimonial.author.charAt(0)}
                   </span>
                 </div>
                 <div>
                   <p className="text-sm font-medium">{testimonial.author}</p>
                   <p className="text-xs text-muted-foreground">{testimonial.location}</p>
                 </div>
               </div>
             </div>
           ))}
         </div>
       </div>
     </section>
   );
 }