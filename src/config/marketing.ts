 // Marketing site content configuration
 // All text is editable from this single file
 
 export const MARKETING_CONFIG = {
   // App URL - the PWA domain
   appUrl: '/auth',
   
   // Site metadata
   meta: {
     title: 'AI Garderobsassistent | Din personliga stilist',
     description: 'AI som organiserar dina plagg och bygger outfits för väder, tillfälle och din stil. Privat, smart och byggd för vardagen.',
     ogImage: '/og-image.png',
   },
   
   // Hero section
   hero: {
     headline: 'Din garderob. Din stil. På 10 sekunder.',
     subheadline: 'AI som organiserar dina plagg och bygger outfits för väder, tillfälle och din vibe.',
     primaryCta: 'Öppna appen',
     secondaryCta: 'Installera som app',
     trustItems: [
       'Privat lagring',
       'Inga krångliga steg',
       'Byggd för vardagen',
     ],
   },
   
   // Social proof section
   socialProof: {
     headline: 'Används för att få mer av kläderna du redan äger',
     testimonials: [
       {
         quote: 'Äntligen vet jag vad jag har i garderoben. Sparar tid varje morgon.',
         author: 'Emma S.',
         location: 'Stockholm',
       },
       {
         quote: 'Perfekt för att hitta nya kombinationer av plagg jag redan äger.',
         author: 'Marcus L.',
         location: 'Göteborg',
       },
       {
         quote: 'Enkelt att använda. Mina outfits passar alltid vädret nu.',
         author: 'Sofia N.',
         location: 'Malmö',
       },
     ],
   },
   
   // Product demo section
   demo: {
     headline: 'Så fungerar det',
     steps: [
       {
         id: 'add',
         title: 'Lägg till plagg',
         description: 'Fota, importera länkar eller batch-ladda upp.',
         icon: 'camera',
       },
       {
         id: 'outfit',
         title: 'Skapa outfit',
         description: 'AI föreslår kombinationer baserat på väder och tillfälle.',
         icon: 'sparkles',
       },
       {
         id: 'plan',
         title: 'Planera veckan',
         description: 'Schemalägg outfits med kalenderintegration.',
         icon: 'calendar',
       },
       {
         id: 'insights',
         title: 'Insikter',
         description: 'Se vad du använder mest och vad som glöms bort.',
         icon: 'chart',
       },
     ],
   },
   
   // Benefits section
   benefits: {
     headline: 'Varför AI Garderobsassistent',
     items: [
       {
         title: '2-minuters garderob',
         description: 'Ladda upp plagg snabbt med foto, länkar eller batch-import.',
         icon: 'zap',
       },
       {
         title: 'Outfits som passar livet',
         description: 'AI anpassar förslagen efter väder, tillfälle och din stil.',
         icon: 'sparkles',
       },
       {
         title: 'Planera veckan',
         description: 'Schemalägg outfits och synka med din kalender.',
         icon: 'calendar',
       },
       {
         title: 'Insikter som förändrar',
         description: 'Upptäck mönster och använd dina kläder smartare.',
         icon: 'lightbulb',
       },
       {
         title: 'AI-drivna förslag',
         description: 'Byt ut plagg eller skapa liknande outfits med ett klick.',
         icon: 'wand',
       },
     ],
   },
   
   // Features accordion
   features: {
     headline: 'Alla funktioner',
     items: [
       {
         title: 'Digital garderob',
         content: 'Lägg till plagg via foto, batch-uppladdning eller importera från webblänkar (max 30 st). AI analyserar färg, material, stil och säsong automatiskt.',
       },
       {
         title: 'Outfit-generator',
         content: 'Skapa outfits baserat på väder och tillfälle. Byt ut enskilda plagg, skapa liknande outfits, planera för framtida datum och markera som använd med ångra-funktion.',
       },
       {
         title: 'Kalender & planering',
         content: 'Planera outfits upp till 7 dagar framåt. Visa väderprognoser för planerade datum. Integrerar med Google och Microsoft-kalendrar.',
       },
       {
         title: 'Delning',
         content: 'Dela dina outfits via länk eller ladda ner som bild. Perfekt för att få feedback eller inspirera andra.',
       },
       {
         title: 'Data & integritet',
         content: 'Alla bilder lagras privat. Du äger din data och kan radera ditt konto helt när som helst.',
       },
     ],
   },
   
   // PWA install section
   pwaInstall: {
     headline: 'Installera appen',
     subheadline: 'Få fullständig app-upplevelse direkt från hemskärmen.',
     iphoneTitle: 'iPhone / iPad',
     iphoneSteps: [
       'Öppna i Safari',
       'Tryck på Dela-ikonen',
       'Välj "Lägg till på hemskärmen"',
     ],
     androidTitle: 'Android',
     androidButton: 'Installera appen',
     androidFallbackSteps: [
       'Öppna i Chrome',
       'Tryck på menyn (⋮)',
       'Välj "Installera app" eller "Lägg till på hemskärmen"',
     ],
   },
   
   // Email capture section
   emailCapture: {
     headline: 'Få tidig access och uppdateringar',
     placeholder: 'Din e-postadress',
     button: 'Skriv upp mig',
     successMessage: 'Klart. Vi hör av oss.',
     errorMessage: 'Något gick fel. Försök igen.',
     duplicateMessage: 'Den här e-postadressen är redan registrerad.',
   },
   
   // FAQ section
   faq: {
     headline: 'Vanliga frågor',
     items: [
       {
         question: 'Behöver jag fota allt?',
         answer: 'Nej, du kan även importera via webblänkar eller batch-ladda upp bilder.',
       },
       {
         question: 'Funkar det på iPhone?',
         answer: 'Ja, appen fungerar som en PWA (Progressive Web App) som du installerar via Safari.',
       },
       {
         question: 'Är mina bilder privata?',
         answer: 'Ja, alla bilder lagras privat och är endast tillgängliga för dig.',
       },
       {
         question: 'Kan jag radera allt?',
         answer: 'Ja, du kan radera ditt konto och all data helt när som helst.',
       },
       {
         question: 'Krävs kalenderintegration?',
         answer: 'Nej, men det gör planeringen smartare och mer automatiserad.',
       },
     ],
   },
   
   // Final CTA section
   finalCta: {
     headline: 'Redo att använda garderoben bättre?',
     primaryCta: 'Öppna appen',
     secondaryCta: 'Installera som app',
   },
   
   // Footer
   footer: {
     copyright: '© 2025 AI Garderobsassistent',
     links: [
       { label: 'Integritetspolicy', href: '/privacy' },
       { label: 'Villkor', href: '/terms' },
       { label: 'Kontakt', href: '/contact' },
     ],
   },
   
   // Privacy policy
   privacy: {
     title: 'Integritetspolicy',
     lastUpdated: '2025-02-05',
     contactEmail: 'privacy@example.com',
     sections: [
       {
         title: 'Data vi samlar in',
         content: 'Vi samlar in information du ger oss direkt, såsom e-postadress vid registrering, bilder på plagg du laddar upp, och dina outfit-preferenser. Vi samlar även teknisk data som enhetstyp och användningsmönster för att förbättra tjänsten.',
       },
       {
         title: 'Lagring',
         content: 'All data lagras säkert i molnet med stark kryptering. Bilder på plagg lagras privat och är endast tillgängliga för ditt konto.',
       },
       {
         title: 'Analys',
         content: 'Vi använder anonym analytik för att förstå hur tjänsten används och förbättra upplevelsen. Ingen personlig data delas med tredje part för marknadsföring.',
       },
       {
         title: 'Tredjepartstjänster',
         content: 'Vi använder externa tjänster för lagring, autentisering och betalningar. Dessa följer branschstandard för säkerhet och integritet.',
       },
       {
         title: 'Radering',
         content: 'Du kan när som helst radera ditt konto och all tillhörande data via inställningarna i appen. Radering är permanent och oåterkallelig.',
       },
     ],
   },
   
   // Terms of service
   terms: {
     title: 'Användarvillkor',
     lastUpdated: '2025-02-05',
     sections: [
       {
         title: 'Acceptans',
         content: 'Genom att använda AI Garderobsassistent accepterar du dessa villkor. Om du inte accepterar, vänligen använd inte tjänsten.',
       },
       {
         title: 'Tjänsten',
         content: 'AI Garderobsassistent är en digital garderobshanterare som hjälper dig organisera plagg och skapa outfits. Tjänsten tillhandahålls "som den är" utan garantier.',
       },
       {
         title: 'Ditt innehåll',
         content: 'Du behåller äganderätten till bilder och innehåll du laddar upp. Du ger oss rätt att använda detta för att tillhandahålla tjänsten till dig.',
       },
       {
         title: 'Begränsningar',
         content: 'Vi ansvarar inte för eventuella skador som uppstår från användning av tjänsten. Maximalt ansvar begränsas till avgifter du betalat de senaste 12 månaderna.',
       },
       {
         title: 'Ändringar',
         content: 'Vi kan uppdatera dessa villkor. Väsentliga ändringar meddelas via e-post eller i appen.',
       },
     ],
   },
   
   // Contact page
   contact: {
     title: 'Kontakt',
     subtitle: 'Har du frågor? Vi hjälper gärna till.',
     email: 'hello@example.com',
     form: {
       namePlaceholder: 'Ditt namn',
       emailPlaceholder: 'Din e-postadress',
       messagePlaceholder: 'Ditt meddelande',
       button: 'Skicka meddelande',
       successMessage: 'Tack för ditt meddelande. Vi återkommer inom kort.',
     },
   },
 };