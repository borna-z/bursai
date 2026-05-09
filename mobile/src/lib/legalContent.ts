// Long-form privacy + terms copy, rendered by PrivacyPolicyScreen and
// TermsScreen. Kept out of the i18n locale files because each section is
// 200–400 words of body copy — dropping it into `en.ts` / `sv.ts` would
// triple their size and dwarf every other key. Instead the structure
// (heading + body paragraph blocks) lives here, and the surrounding screen
// chrome (eyebrow / title / "last updated" label / "view web version"
// fallback) reads from the regular i18n files where M33 already runs the
// translation pipeline.
//
// Every section is a heading + an array of body paragraphs. Empty strings
// are not allowed (the screen would render an unstyled blank line).
//
// Copy authored 2026-05-09. Bump LAST_UPDATED whenever the legal text
// materially changes; PrivacyPolicyScreen + TermsScreen render the value
// verbatim under the page title.

import type { Locale } from './i18n';

export type LegalSection = {
  heading: string;
  paragraphs: readonly string[];
};

export type LegalDocument = {
  title: string;
  intro: string;
  lastUpdatedLabel: string;
  sections: readonly LegalSection[];
};

export const LAST_UPDATED = '2026-05-09';

// English copy is the source of truth. Other locales fall through to `en`
// until M33's translation pipeline runs over the legal text. Returning the
// English copy is preferable to a half-translated mix that confuses App
// Review and end users alike.
const PRIVACY_EN: LegalDocument = {
  title: 'Privacy Policy',
  intro:
    'BURS is a personal styling app that helps you understand and manage your wardrobe. Your data is yours — this policy explains what we collect, why, and how you can control it.',
  lastUpdatedLabel: `Last updated ${LAST_UPDATED}`,
  sections: [
    {
      heading: 'Data we collect',
      paragraphs: [
        'Account information you provide when you sign up: email address, display name, and (optionally) a profile photo.',
        'Wardrobe data you create in the app: garment photos and the metadata BURS extracts from them (category, color, material, season), occasions you tag, outfits you save, and notes you add.',
        'AI interactions: chat history with the AI stylist, the style profile BURS builds from your taste signals, and feedback you give on suggestions.',
        'Usage and diagnostic data: anonymous error reports and performance traces sent to Sentry to keep the app stable. We do not collect advertising identifiers.',
        'Payment data: when you subscribe, your purchase receipt is processed by Apple, Google, or RevenueCat. BURS never sees your card number.',
      ],
    },
    {
      heading: 'How we use your data',
      paragraphs: [
        'To render outfits, run wardrobe analysis, and generate AI styling recommendations tailored to your closet.',
        'To send transactional notifications (laundry reminders, plan-ahead nudges, subscription receipts) — only the categories you have enabled in Settings.',
        'To provide customer support when you contact us.',
        'To diagnose crashes and improve reliability via aggregated, de-identified diagnostics.',
      ],
    },
    {
      heading: 'Sharing with service providers',
      paragraphs: [
        'BURS uses a small set of processors to operate the service. They only see what is necessary for their function:',
        '• Supabase — managed Postgres + storage that holds your account, wardrobe, and outfit data.',
        '• Sentry — anonymous crash and error reports.',
        '• RevenueCat — subscription receipt validation and entitlement state.',
        '• Resend — transactional email (account verification, password reset).',
        '• Google Calendar — only if you explicitly connect it in Settings; we read events you authorize and never write to your calendar.',
        'We do not sell or rent your personal data. We do not share it with advertisers.',
      ],
    },
    {
      heading: 'Retention',
      paragraphs: [
        'We keep your data until you delete your account. You can delete your account at any time from Settings → Account → Delete account; the action removes your profile, wardrobe, outfits, and chat history within 30 days.',
        'Anonymous diagnostic data may be retained longer in aggregate form for reliability analysis.',
      ],
    },
    {
      heading: 'Your rights (GDPR)',
      paragraphs: [
        'If you live in the EU/EEA, UK, or Switzerland you have the right to access, correct, port, or delete your personal data, and to object to or restrict processing.',
        'You can exercise these rights from inside the app (Settings → Privacy & data) or by emailing support@burs.me. We respond within 30 days.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        'BURS is not intended for children under 13. If you believe a child has created an account, contact us and we will remove it.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        'Questions, requests, or complaints: support@burs.me.',
      ],
    },
  ],
};

const TERMS_EN: LegalDocument = {
  title: 'Terms of Service',
  intro:
    'These terms govern your use of BURS. By creating an account or using the app you agree to them. Please read the whole document — it is intentionally short and plain.',
  lastUpdatedLabel: `Last updated ${LAST_UPDATED}`,
  sections: [
    {
      heading: 'Your account',
      paragraphs: [
        'You must provide accurate information when signing up and keep your credentials secure. You are responsible for activity on your account.',
        'You must be at least 13 years old to use BURS. If you are under the age of majority in your country you must have a parent or guardian agree to these terms on your behalf.',
      ],
    },
    {
      heading: 'Subscription and billing',
      paragraphs: [
        'BURS offers monthly and yearly subscription plans. Pricing for the launch market (Sweden) is displayed on the in-app paywall before purchase.',
        'Subscriptions auto-renew at the end of each billing period unless you cancel at least 24 hours before renewal. You can manage or cancel your subscription at any time through your Apple ID or Google Play account settings.',
        'Refunds for App Store and Google Play purchases are handled by the respective stores, not by BURS directly.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: [
        'Do not use BURS for anything illegal, abusive, or that infringes someone else’s rights.',
        'Do not scrape, reverse-engineer, or attempt to extract our servers’ source data, models, or other accounts’ wardrobe data.',
        'Do not upload content you do not have the right to share.',
      ],
    },
    {
      heading: 'AI-generated content',
      paragraphs: [
        'BURS uses AI to suggest outfits, identify garments, and generate styling advice. These suggestions are recommendations, not professional styling, fashion-investment, or personal-shopping advice.',
        'AI is imperfect — verify important details (fit, occasion suitability, weather appropriateness) yourself before acting on a suggestion.',
      ],
    },
    {
      heading: 'Your content and intellectual property',
      paragraphs: [
        'Your wardrobe photos, notes, and outfits remain yours. By uploading them you grant BURS a limited license to store, process, and display them inside your account so the service can function.',
        'You may revoke this license at any time by deleting the content or your account.',
        'BURS, the wordmark, and the app’s design and code are our intellectual property and may not be copied without permission.',
      ],
    },
    {
      heading: 'Limitation of liability',
      paragraphs: [
        'BURS is provided "as is" without warranties of any kind. To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from your use of the service.',
        'Nothing in these terms limits liability that cannot be limited under applicable law (such as for gross negligence or wilful misconduct).',
      ],
    },
    {
      heading: 'Termination',
      paragraphs: [
        'You can stop using BURS and delete your account at any time. We may suspend or terminate accounts that violate these terms, attempt to abuse the service, or fail to pay for an active subscription.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: [
        'We may update these terms when the service changes meaningfully. Material changes will be announced in-app at least 14 days before they take effect.',
      ],
    },
    {
      heading: 'Governing law',
      paragraphs: [
        'These terms are governed by the laws of Sweden. Disputes will be resolved by the courts of Stockholm, unless a mandatory consumer-protection law in your country grants you the right to bring a claim locally.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        'Questions about these terms: support@burs.me.',
      ],
    },
  ],
};

// Locale → document maps. Each unsupported locale falls through to English
// at lookup time so the screens never render blank pages.
const PRIVACY_BY_LOCALE: Partial<Record<Locale, LegalDocument>> = {
  en: PRIVACY_EN,
};

const TERMS_BY_LOCALE: Partial<Record<Locale, LegalDocument>> = {
  en: TERMS_EN,
};

export function getPrivacyDocument(locale: Locale): LegalDocument {
  return PRIVACY_BY_LOCALE[locale] ?? PRIVACY_EN;
}

export function getTermsDocument(locale: Locale): LegalDocument {
  return TERMS_BY_LOCALE[locale] ?? TERMS_EN;
}
