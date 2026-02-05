 import { ChevronDown } from 'lucide-react';
 import { MARKETING_CONFIG } from '@/config/marketing';
 import { trackMarketingEvent } from '@/lib/marketingAnalytics';
 import {
   Accordion,
   AccordionContent,
   AccordionItem,
   AccordionTrigger,
 } from '@/components/ui/accordion';
 
 export function FeaturesSection() {
   const { features } = MARKETING_CONFIG;
 
   const handleAccordionChange = (value: string) => {
     if (value) {
       trackMarketingEvent('faq_open', { section: 'features', item: value });
     }
   };
 
   return (
     <section className="py-16 md:py-24">
       <div className="max-w-3xl mx-auto px-4">
         {/* Section headline */}
         <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 md:mb-16">
           {features.headline}
         </h2>
         
         {/* Accordion */}
         <Accordion
           type="single"
           collapsible
           className="space-y-3"
           onValueChange={handleAccordionChange}
         >
           {features.items.map((item, index) => (
             <AccordionItem
               key={index}
               value={`item-${index}`}
               className="bg-card border border-border/50 rounded-xl px-6 data-[state=open]:shadow-sm transition-shadow"
             >
               <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                 {item.title}
               </AccordionTrigger>
               <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                 {item.content}
               </AccordionContent>
             </AccordionItem>
           ))}
         </Accordion>
       </div>
     </section>
   );
 }