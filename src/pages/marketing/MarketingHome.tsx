 import { useRef } from 'react';
 import { Helmet } from 'react-helmet-async';
 import { MarketingLayout } from '@/components/marketing/MarketingLayout';
 import { HeroSection } from '@/components/marketing/HeroSection';
 import { SocialProofSection } from '@/components/marketing/SocialProofSection';
 import { ProductDemoSection } from '@/components/marketing/ProductDemoSection';
 import { BenefitsSection } from '@/components/marketing/BenefitsSection';
 import { FeaturesSection } from '@/components/marketing/FeaturesSection';
 import { PWAInstallSection } from '@/components/marketing/PWAInstallSection';
 import { EmailCaptureSection } from '@/components/marketing/EmailCaptureSection';
 import { FAQSection } from '@/components/marketing/FAQSection';
 import { FinalCTASection } from '@/components/marketing/FinalCTASection';
 import { MARKETING_CONFIG } from '@/config/marketing';
 
 export default function MarketingHome() {
   const installSectionRef = useRef<HTMLElement>(null);
 
   return (
     <>
       <Helmet>
         <title>{MARKETING_CONFIG.meta.title}</title>
         <meta name="description" content={MARKETING_CONFIG.meta.description} />
         
         {/* Open Graph */}
         <meta property="og:title" content={MARKETING_CONFIG.meta.title} />
         <meta property="og:description" content={MARKETING_CONFIG.meta.description} />
         <meta property="og:type" content="website" />
         <meta property="og:locale" content="sv_SE" />
         
         {/* Twitter */}
         <meta name="twitter:card" content="summary_large_image" />
         <meta name="twitter:title" content={MARKETING_CONFIG.meta.title} />
         <meta name="twitter:description" content={MARKETING_CONFIG.meta.description} />
         
         {/* Structured Data */}
         <script type="application/ld+json">
           {JSON.stringify({
             "@context": "https://schema.org",
             "@type": "SoftwareApplication",
             "name": "AI Garderobsassistent",
             "applicationCategory": "LifestyleApplication",
             "operatingSystem": "Web",
             "offers": {
               "@type": "Offer",
               "price": "0",
               "priceCurrency": "SEK"
             },
             "description": MARKETING_CONFIG.meta.description,
           })}
         </script>
       </Helmet>
       
       <MarketingLayout>
         <HeroSection installSectionRef={installSectionRef} />
         <SocialProofSection />
         <ProductDemoSection />
         <BenefitsSection />
         <FeaturesSection />
         <PWAInstallSection ref={installSectionRef} />
         <EmailCaptureSection />
         <FAQSection />
         <FinalCTASection installSectionRef={installSectionRef} />
       </MarketingLayout>
     </>
   );
 }