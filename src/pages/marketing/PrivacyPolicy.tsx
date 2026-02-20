 import { Helmet } from 'react-helmet-async';
 import { MarketingLayout } from '@/components/marketing/MarketingLayout';
 import { MARKETING_CONFIG } from '@/config/marketing';
 
 export default function PrivacyPolicy() {
   const { privacy } = MARKETING_CONFIG;
 
   return (
     <>
       <Helmet>
            <title>{privacy.title} | DRAPE</title>
            <meta name="description" content="Integritetspolicy för DRAPE – hur vi hanterar din data." />
       </Helmet>
       
       <MarketingLayout>
         <div className="max-w-3xl mx-auto px-4 py-16 md:py-24">
           <h1 className="text-3xl md:text-4xl font-bold mb-4">{privacy.title}</h1>
           <p className="text-muted-foreground mb-12">
             Senast uppdaterad: {privacy.lastUpdated}
           </p>
           
           <div className="space-y-8">
             {privacy.sections.map((section, index) => (
               <section key={index}>
                 <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
                 <p className="text-muted-foreground leading-relaxed">
                   {section.content}
                 </p>
               </section>
             ))}
             
             <section>
               <h2 className="text-xl font-semibold mb-3">Kontakt</h2>
               <p className="text-muted-foreground leading-relaxed">
                 För frågor om integritet, kontakta oss på{' '}
                 <a 
                   href={`mailto:${privacy.contactEmail}`}
                   className="text-primary hover:underline"
                 >
                   {privacy.contactEmail}
                 </a>
               </p>
             </section>
           </div>
         </div>
       </MarketingLayout>
     </>
   );
 }