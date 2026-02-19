// Marketing site content configuration
// All text is editable from this single file

export const MARKETING_CONFIG = {
  // App URL - the PWA domain
  appUrl: '/auth',
  
  // Site metadata
  meta: {
    title: 'DRAPE | Your Personal Stylist',
    description: 'Your AI stylist learns your body, style, and calendar – and suggests outfits perfectly suited for your day. Private, smart, and built for everyday life.',
    ogImage: '/og-image.png',
  },
  
  // Hero section
  hero: {
    headline: 'Your personal stylist. Always available.',
    subheadline: 'AI that learns your style, reads your calendar, and suggests the right outfit for every occasion – morning, meeting, and dinner.',
    primaryCta: 'Get started free',
    secondaryCta: 'Install as app',
    trustItems: [
      'Private storage',
      'No complicated steps',
      'Personal AI stylist',
    ],
  },
  
  // Social proof section
  socialProof: {
    headline: 'More style, less stress – every morning',
    testimonials: [
      {
        quote: 'The AI stylist learned my style after just a few days. Not a single wrong outfit since.',
        author: 'Emma S.',
        location: 'Stockholm',
      },
      {
        quote: 'The calendar integration is pure magic. It automatically suggests the right outfit depending on whether I have a meeting or workout.',
        author: 'Marcus L.',
        location: 'Gothenburg',
      },
      {
        quote: 'Finally I know what I have. The AI stylist gives advice on fit based on my measurements.',
        author: 'Sofia N.',
        location: 'Malmö',
      },
    ],
  },
  
  // Product demo section
  demo: {
    headline: 'Four steps to your perfect outfit',
    steps: [
      {
        id: 'add',
        title: 'Build your wardrobe',
        description: 'Snap a photo, import via link, or batch upload. AI automatically tags color, material, and style.',
        icon: 'camera',
      },
      {
        id: 'chat',
        title: 'Chat with your stylist',
        description: 'Your AI stylist learns your age, lifestyle, and preferences to give personalized advice on fit and style.',
        icon: 'bot',
      },
      {
        id: 'plan',
        title: 'Smart calendar planning',
        description: 'Sync your calendar and get outfit suggestions tailored for every event – meeting, workout, or party.',
        icon: 'calendar',
      },
      {
        id: 'outfit',
        title: 'The right outfit every day',
        description: 'Choose, plan, and mark outfits as worn. Swap individual garments with a single tap.',
        icon: 'sparkles',
      },
    ],
  },
  
  // Benefits section
  benefits: {
    headline: 'More than a digital wardrobe',
    items: [
      {
        title: 'AI stylist that learns you',
        description: 'Chat about your style, career, and lifestyle. The stylist remembers and gives increasingly personal advice.',
        icon: 'bot',
      },
      {
        title: 'Smart calendar integration',
        description: 'Sync Google, Outlook, or Apple Calendar. Get outfit suggestions based on your daily events.',
        icon: 'calendar',
      },
      {
        title: 'Fit-adjusted advice',
        description: 'Enter your height and weight so the AI can advise on proportions, cuts, and style choices for your body.',
        icon: 'ruler',
      },
      {
        title: 'Outfits for every occasion',
        description: 'Meeting in the morning, workout at lunch, dinner in the evening – the app suggests the right garments for everything.',
        icon: 'sparkles',
      },
      {
        title: 'Plan your whole week',
        description: 'Schedule outfits and see weather forecasts for planned dates. Never stress in the morning again.',
        icon: 'zap',
      },
      {
        title: 'Insights that matter',
        description: 'Discover which garments you actually wear and which ones are just taking up space.',
        icon: 'lightbulb',
      },
    ],
  },
  
  // Features accordion
  features: {
    headline: 'All features',
    items: [
      {
        title: 'AI Stylist (new)',
        content: 'Chat directly with your personal AI stylist. It learns your career, age, lifestyle, and style preferences. The more you share, the better and more personalized the advice. Conversation history is saved and the stylist remembers your dialogue.',
      },
      {
        title: 'Smart Calendar Planning (new)',
        content: 'Sync your Google, Outlook, or Apple calendar via ICS link. The app reads your events and automatically suggests outfit combinations tailored for every occasion – work meeting, gym session, or dinner party. The entire process is explained step by step in the app.',
      },
      {
        title: 'Personal Fit (new)',
        content: 'Enter your height and weight during registration. The AI stylist uses your measurements to advise on proportions, cuts, and which styles suit your body. This information is private and never used for anything else.',
      },
      {
        title: 'Digital Wardrobe',
        content: 'Add garments via photo, batch upload, or import from web links. AI analyzes color, material, style, and season automatically. All images are stored privately and only accessible to you.',
      },
      {
        title: 'Outfit Generator',
        content: 'Create outfits based on weather and occasion. Swap individual garments, create similar outfits, plan for future dates, and mark as worn with an undo feature.',
      },
      {
        title: 'Sharing & Insights',
        content: 'Share outfits via link or download as image. See statistics on which garments you wear most and what gets forgotten in the wardrobe. Delete your account and all data completely whenever you want.',
      },
    ],
  },
  
  // PWA install section
  pwaInstall: {
    headline: 'Install the app',
    subheadline: 'Get the full app experience directly from your home screen.',
    iphoneTitle: 'iPhone / iPad',
    iphoneSteps: [
      'Open in Safari',
      'Tap the Share icon',
      'Select "Add to Home Screen"',
    ],
    androidTitle: 'Android',
    androidButton: 'Install the app',
    androidFallbackSteps: [
      'Open in Chrome',
      'Tap the menu (⋮)',
      'Select "Install app" or "Add to Home Screen"',
    ],
  },
  
  // Email capture section
  emailCapture: {
    headline: 'Get early access and updates',
    placeholder: 'Your email address',
    button: 'Sign me up',
    successMessage: 'Done. We\'ll be in touch.',
    errorMessage: 'Something went wrong. Please try again.',
    duplicateMessage: 'This email address is already registered.',
  },
  
  // FAQ section
  faq: {
    headline: 'Frequently asked questions',
    items: [
      {
        question: 'How does the AI stylist work?',
        answer: 'You chat with your personal AI stylist about your style, career, and preferences. The stylist learns about you and gives increasingly personalized advice. Conversation history is saved so it always remembers your dialogue.',
      },
      {
        question: 'How do I sync my calendar?',
        answer: 'The app supports Google Calendar, Outlook, and Apple Calendar via ICS link. In settings you\'ll find a step-by-step guide for each calendar type. No extra app installation needed – just a link.',
      },
      {
        question: 'Why does the AI need my body measurements?',
        answer: 'Height and weight (optional) help the AI stylist advise on proportions, cuts, and fit. This information is strictly private, encrypted, and never used for anything else. You can skip it if you prefer.',
      },
      {
        question: 'Do I need to photograph everything?',
        answer: 'No, you can also import garments via web links or batch upload images from your camera roll.',
      },
      {
        question: 'Are my images and data private?',
        answer: 'Yes. All images and personal data are stored privately and only accessible to you. We never share data with third parties for marketing.',
      },
      {
        question: 'Can I delete everything?',
        answer: 'Yes, you can delete your account and all data – images, chats, and garments – completely from the settings in the app.',
      },
      {
        question: 'Does it work on iPhone?',
        answer: 'Yes, the app works as a PWA (Progressive Web App) that you can easily install via Safari on iPhone and iPad.',
      },
    ],
  },
  
  // Final CTA section
  finalCta: {
    headline: 'Ready to meet your personal stylist?',
    primaryCta: 'Get started free',
    secondaryCta: 'Install as app',
  },
  
  // Footer
  footer: {
    copyright: '© 2025 DRAPE',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  
  // Privacy policy
  privacy: {
    title: 'Privacy Policy',
    lastUpdated: '2025-02-19',
    contactEmail: 'privacy@example.com',
    sections: [
      {
        title: 'Data we collect',
        content: 'We collect information you provide directly, such as your email address at registration, images of garments you upload, conversations with the AI stylist, and optional body measurements (height and weight). We also collect technical data such as device type and usage patterns to improve the service.',
      },
      {
        title: 'Storage',
        content: 'All data is stored securely in the cloud with strong encryption. Images of garments, body, and conversation history are stored privately and only accessible to your account. Body measurements are stored encrypted and never shared.',
      },
      {
        title: 'Calendar data',
        content: 'If you choose to connect your calendar via ICS link, the app reads event titles and dates to provide smart outfit suggestions. Calendar data is stored locally and not synchronized with third parties.',
      },
      {
        title: 'AI Stylist',
        content: 'Conversations with the AI stylist are saved encrypted so the stylist can remember your preferences. The content of conversations is not shared with third parties and is not used for AI model training.',
      },
      {
        title: 'Analytics',
        content: 'We use anonymous analytics to understand how the service is used and improve the experience. No personal data is shared with third parties for marketing.',
      },
      {
        title: 'Deletion',
        content: 'You can delete your account and all associated data at any time – including images, garments, chats, and body measurements – from the settings in the app. Deletion is permanent and irreversible.',
      },
    ],
  },
  
  // Terms of service
  terms: {
    title: 'Terms of Service',
    lastUpdated: '2025-02-19',
    sections: [
      {
        title: 'Acceptance',
        content: 'By using DRAPE you accept these terms. If you do not accept, please do not use the service.',
      },
      {
        title: 'The Service',
        content: 'DRAPE is a digital wardrobe manager and personal AI stylist that helps you organize garments, create outfits, and plan your wardrobe. The service is provided "as is" without warranties.',
      },
      {
        title: 'Your Content',
        content: 'You retain ownership of images and content you upload. You grant us the right to use this to provide the service to you.',
      },
      {
        title: 'Body measurements and personal data',
        content: 'Body measurements (height and weight) are optional and used exclusively to improve the AI stylist\'s advice. This data is stored encrypted and deleted upon your request.',
      },
      {
        title: 'Limitations',
        content: 'We are not liable for any damages arising from use of the service. Maximum liability is limited to fees you have paid in the last 12 months.',
      },
      {
        title: 'Changes',
        content: 'We may update these terms. Material changes will be communicated via email or in the app.',
      },
    ],
  },
  
  // Contact page
  contact: {
    title: 'Contact',
    subtitle: 'Have questions? We\'re happy to help.',
    email: 'hello@example.com',
    form: {
      namePlaceholder: 'Your name',
      emailPlaceholder: 'Your email address',
      messagePlaceholder: 'Your message',
      button: 'Send message',
      successMessage: 'Thank you for your message. We\'ll get back to you shortly.',
    },
  },
};
