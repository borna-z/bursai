 import { Helmet } from 'react-helmet-async';
 import { MarketingLayout } from '@/components/marketing/MarketingLayout';
 import { MARKETING_CONFIG } from '@/config/marketing';
 
 export default function Terms() {
   const { terms } = MARKETING_CONFIG;
 
   return (
     <>
       <Helmet>
            <title>{terms.title} | DRAPE</title>
            <meta name="description" content="Användarvillkor för DRAPE." />
       </Helmet>
       
       <MarketingLayout>
         <div className="max-w-3xl mx-auto px-4 py-16 md:py-24">
           <h1 className="text-3xl md:text-4xl font-bold mb-4">{terms.title}</h1>
           <p className="text-muted-foreground mb-12">
             Senast uppdaterad: {terms.lastUpdated}
           </p>
           
           <div className="space-y-8">
             {terms.sections.map((section, index) => (
               <section key={index}>
                 <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
                 <p className="text-muted-foreground leading-relaxed">
                   {section.content}
                 </p>
               </section>
             ))}
           </div>
         </div>
       </MarketingLayout>
     </>
   );
 }