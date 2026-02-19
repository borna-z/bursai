// Marketing site content configuration
// All text is editable from this single file

export const MARKETING_CONFIG = {
  // App URL - the PWA domain
  appUrl: '/auth',
  
  // Site metadata
  meta: {
    title: 'AI Garderobsassistent | Din personliga stylist',
    description: 'Din AI-stylist lär känna din kropp, stil och kalender – och föreslår outfits som passar exakt din dag. Privat, smart och byggd för vardagen.',
    ogImage: '/og-image.png',
  },
  
  // Hero section
  hero: {
    headline: 'Din personliga stylist. Alltid tillgänglig.',
    subheadline: 'AI som lär sig din stil, läser din kalender och föreslår rätt outfit för varje tillfälle – morgon, möte och middag.',
    primaryCta: 'Kom igång gratis',
    secondaryCta: 'Installera som app',
    trustItems: [
      'Privat lagring',
      'Inga krångliga steg',
      'Personlig AI-stylist',
    ],
  },
  
  // Social proof section
  socialProof: {
    headline: 'Mer stil, mindre stress – varje morgon',
    testimonials: [
      {
        quote: 'AI-stylisten lärde sig min stil efter bara några dagar. Inte en enda felaktig outfit sedan dess.',
        author: 'Emma S.',
        location: 'Stockholm',
      },
      {
        quote: 'Kalenderintegrationen är helt magisk. Den föreslår automatiskt rätt outfit beroende på om jag har möte eller träning.',
        author: 'Marcus L.',
        location: 'Göteborg',
      },
      {
        quote: 'Äntligen vet jag vad jag har. AI-stylisten ger råd om passform baserat på mina mått.',
        author: 'Sofia N.',
        location: 'Malmö',
      },
    ],
  },
  
  // Product demo section
  demo: {
    headline: 'Fyra steg till din perfekta outfit',
    steps: [
      {
        id: 'add',
        title: 'Bygg din garderob',
        description: 'Fota, importera via länk eller batch-ladda upp. AI taggar automatiskt färg, material och stil.',
        icon: 'camera',
      },
      {
        id: 'chat',
        title: 'Chatta med din stylist',
        description: 'Din AI-stylist lär sig din ålder, livsstil och preferenser för att ge personliga råd om passform och stil.',
        icon: 'bot',
      },
      {
        id: 'plan',
        title: 'Smart kalenderplanering',
        description: 'Synka din kalender och få outfit-förslag anpassade för varje händelse – möte, träning eller fest.',
        icon: 'calendar',
      },
      {
        id: 'outfit',
        title: 'Rätt outfit varje dag',
        description: 'Välj, planera och markera outfits som använda. Byt ut enskilda plagg med ett tryck.',
        icon: 'sparkles',
      },
    ],
  },
  
  // Benefits section
  benefits: {
    headline: 'Mer än en digital garderob',
    items: [
      {
        title: 'AI-stylist som lär sig dig',
        description: 'Chatta om din stil, ditt yrke och din livsstil. Stylisten minns och ger alltmer personliga råd.',
        icon: 'bot',
      },
      {
        title: 'Smart kalenderintegration',
        description: 'Synka Google, Outlook eller Apple Calendar. Få outfit-förslag baserade på dina dagliga händelser.',
        icon: 'calendar',
      },
      {
        title: 'Passform-anpassade råd',
        description: 'Ange din längd och vikt så ger AI:n råd om proportioner, snitt och stilval för just din kropp.',
        icon: 'ruler',
      },
      {
        title: 'Outfits för varje tillfälle',
        description: 'Möte på morgonen, träning på lunchen och middag på kvällen – appen föreslår rätt plagg för allt.',
        icon: 'sparkles',
      },
      {
        title: 'Planera hela veckan',
        description: 'Schemalägg outfits och se väderprognoser för planerade datum. Aldrig mer stress på morgonen.',
        icon: 'zap',
      },
      {
        title: 'Insikter som förändrar',
        description: 'Upptäck vilka plagg du verkligen använder och vilka som bara tar plats i garderoben.',
        icon: 'lightbulb',
      },
    ],
  },
  
  // Features accordion
  features: {
    headline: 'Alla funktioner',
    items: [
      {
        title: 'AI-stylist (nytt)',
        content: 'Chatta direkt med din personliga AI-stylist. Den lär sig ditt yrke, din ålder, livsstil och stilpreferenser. Ju mer du berättar, desto bättre och mer personliga råd. Konversationshistoriken sparas och stylisten minns er dialog.',
      },
      {
        title: 'Smart kalenderplanering (nytt)',
        content: 'Synka din Google, Outlook eller Apple-kalender via ICS-länk. Appen läser dina händelser och föreslår automatiskt outfit-kombinationer anpassade för varje tillfälle – jobbmöte, gympass eller middagsbjudning. Hela processen är steg-för-steg förklarad i appen.',
      },
      {
        title: 'Personlig passform (nytt)',
        content: 'Ange din längd och vikt vid registreringen. AI-stylisten använder dina mått för att ge råd om proportioner, snitt och vilka stilar som passar din kropp. Informationen är privat och används aldrig för annat.',
      },
      {
        title: 'Digital garderob',
        content: 'Lägg till plagg via foto, batch-uppladdning eller importera från webblänkar. AI analyserar färg, material, stil och säsong automatiskt. Alla bilder lagras privat och är bara tillgängliga för dig.',
      },
      {
        title: 'Outfit-generator',
        content: 'Skapa outfits baserat på väder och tillfälle. Byt ut enskilda plagg, skapa liknande outfits, planera för framtida datum och markera som använd med ångra-funktion.',
      },
      {
        title: 'Delning & insikter',
        content: 'Dela outfits via länk eller ladda ner som bild. Se statistik över vilka plagg du bär mest och vad som glöms i garderoben. Radera ditt konto och all data helt när du vill.',
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
        question: 'Hur fungerar AI-stylisten?',
        answer: 'Du chattar med din personliga AI-stylist om din stil, ditt yrke och dina preferenser. Stylisten lär sig dig och ger alltmer personliga råd. Konversationshistoriken sparas så att den alltid kommer ihåg er dialog.',
      },
      {
        question: 'Hur synkar jag min kalender?',
        answer: 'Appen stöder Google Calendar, Outlook och Apple Calendar via ICS-länk. I inställningarna finns en steg-för-steg-guide för varje kalendertyp. Ingen extra app-installation krävs – det räcker med en länk.',
      },
      {
        question: 'Varför behöver AI:n mina kroppsmått?',
        answer: 'Längd och vikt (valfritt) hjälper AI-stylisten ge råd om proportioner, snitt och passform. Informationen är strikt privat, krypterad och används aldrig för annat. Du kan hoppa över det om du vill.',
      },
      {
        question: 'Behöver jag fota allt?',
        answer: 'Nej, du kan även importera plagg via webblänkar eller batch-ladda upp bilder från din kamerarulle.',
      },
      {
        question: 'Är mina bilder och data privata?',
        answer: 'Ja. Alla bilder och personuppgifter lagras privat och är endast tillgängliga för dig. Vi delar aldrig data med tredje part för marknadsföring.',
      },
      {
        question: 'Kan jag radera allt?',
        answer: 'Ja, du kan radera ditt konto och all data – bilder, chattar och plagg – helt och hållet från inställningarna i appen.',
      },
      {
        question: 'Fungerar det på iPhone?',
        answer: 'Ja, appen fungerar som en PWA (Progressive Web App) som du enkelt installerar via Safari på iPhone och iPad.',
      },
    ],
  },
  
  // Final CTA section
  finalCta: {
    headline: 'Redo att träffa din personliga stylist?',
    primaryCta: 'Kom igång gratis',
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
    lastUpdated: '2025-02-19',
    contactEmail: 'privacy@example.com',
    sections: [
      {
        title: 'Data vi samlar in',
        content: 'Vi samlar in information du ger oss direkt, såsom e-postadress vid registrering, bilder på plagg du laddar upp, konversationer med AI-stylisten, och eventuella kroppsmått (längd och vikt) som du frivilligt uppger. Vi samlar även teknisk data som enhetstyp och användningsmönster för att förbättra tjänsten.',
      },
      {
        title: 'Lagring',
        content: 'All data lagras säkert i molnet med stark kryptering. Bilder på plagg, kropp och konversationshistorik lagras privat och är endast tillgängliga för ditt konto. Kroppsmått lagras krypterat och delas aldrig.',
      },
      {
        title: 'Kalenderdata',
        content: 'Om du väljer att ansluta din kalender via ICS-länk läser appen händelsetitlar och datum för att ge smarta outfit-förslag. Kalenderdata lagras lokalt och synkroniseras inte med tredje part.',
      },
      {
        title: 'AI-stylisten',
        content: 'Konversationer med AI-stylisten sparas krypterat för att stylisten ska kunna minnas dina preferenser. Innehållet i konversationerna delas inte med tredje part och används inte för träning av AI-modeller.',
      },
      {
        title: 'Analys',
        content: 'Vi använder anonym analytik för att förstå hur tjänsten används och förbättra upplevelsen. Ingen personlig data delas med tredje part för marknadsföring.',
      },
      {
        title: 'Radering',
        content: 'Du kan när som helst radera ditt konto och all tillhörande data – inklusive bilder, plagg, chattar och kroppsmått – via inställningarna i appen. Radering är permanent och oåterkallelig.',
      },
    ],
  },
  
  // Terms of service
  terms: {
    title: 'Användarvillkor',
    lastUpdated: '2025-02-19',
    sections: [
      {
        title: 'Acceptans',
        content: 'Genom att använda AI Garderobsassistent accepterar du dessa villkor. Om du inte accepterar, vänligen använd inte tjänsten.',
      },
      {
        title: 'Tjänsten',
        content: 'AI Garderobsassistent är en digital garderobshanterare och personlig AI-stylist som hjälper dig organisera plagg, skapa outfits och planera din klädsel. Tjänsten tillhandahålls "som den är" utan garantier.',
      },
      {
        title: 'Ditt innehåll',
        content: 'Du behåller äganderätten till bilder och innehåll du laddar upp. Du ger oss rätt att använda detta för att tillhandahålla tjänsten till dig.',
      },
      {
        title: 'Kroppsmått och personuppgifter',
        content: 'Kroppsmått (längd och vikt) är frivilliga och används uteslutande för att förbättra AI-stylistens råd. Dessa uppgifter lagras krypterat och raderas om du begär det.',
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
