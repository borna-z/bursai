import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import bursLogo from '@/assets/burs-monogram.png';

export default function PrivacyPolicy() {
  return (
    <div style={{ background: '#F5F0E8', color: '#1C1917' }}>
      <Helmet>
        <title>Privacy Policy for BURS</title>
        <meta name="description" content="Privacy Policy for BURS — how we collect, use, store, share, and protect your personal data." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://burs.me/privacy" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {/* Header */}
        <header className="w-full" style={{ borderBottom: '1px solid #DDD8CF' }}>
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/welcome" className="flex items-center gap-2">
              <img src={bursLogo} alt="BURS" className="h-7 object-contain" style={{ opacity: 0.8 }} />
              <span className="font-bold tracking-[0.12em] text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1C1917' }}>BURS</span>
            </Link>
            <Link to="/welcome" className="inline-flex items-center gap-1.5 text-sm transition-colors" style={{ color: '#6B6560' }}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 max-w-3xl mx-auto px-4 py-12 md:py-20 w-full">
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#1C1917' }}>Privacy Policy for BURS</h1>
          <p className="mb-2" style={{ color: '#6B6560' }}>Effective date: 25 February 2026</p>
          <p className="mb-10" style={{ color: '#6B6560' }}>Last updated: 25 February 2026</p>

          <div className="space-y-10 text-[15px] leading-relaxed" style={{ color: '#6B6560' }}>

            {/* 1 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Who We Are</h2>
              <p>BURS ("BURS", "we", "us", "our") is a digital wardrobe and AI styling platform available via web and/or progressive web app at burs.me (the "Service").</p>
              <p className="mt-3">This Privacy Policy explains how we collect, use, store, share, and protect personal data when you use BURS, including when you connect your Google Calendar for contextual outfit recommendations.</p>
              <p className="mt-3 font-medium text-foreground">Data Controller (GDPR):</p>
              <p>Burs<br />Email: <a href="mailto:hello@burs.me" className="text-accent hover:underline">hello@burs.me</a></p>
              <p className="mt-3">If you have questions about this Privacy Policy or your personal data, contact us at <a href="mailto:hello@burs.me" className="text-accent hover:underline">hello@burs.me</a>.</p>
            </section>

            {/* 2 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Scope of This Privacy Policy</h2>
              <p>This Privacy Policy applies to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>visitors to burs.me</li>
                <li>users who create a BURS account</li>
                <li>users who upload clothing photos and metadata</li>
                <li>users who use AI styling features</li>
                <li>users who connect third-party services such as Google Calendar</li>
                <li>users who subscribe to premium features</li>
              </ul>
              <p className="mt-3">This Privacy Policy does not apply to third-party websites or services that BURS links to or integrates with (for example, Google, payment processors, or weather providers), which have their own privacy policies.</p>
            </section>

            {/* 3 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. What Data We Collect</h2>
              <p>We collect only the data needed to provide and improve BURS.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">A. Account and Identity Data</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Name or display name</li>
                <li>Email address</li>
                <li>Authentication identifiers (for example, login/account IDs)</li>
                <li>Subscription status and plan information</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4 mb-1">B. Wardrobe and User Content</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Clothing photos you upload</li>
                <li>Clothing metadata (for example, color, category, fabric, tags)</li>
                <li>Outfit combinations you create/save</li>
                <li>Style preferences and feedback (likes/dislikes, selections)</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4 mb-1">C. Usage and Device Data</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>App usage events (for example, feature use, performance, errors)</li>
                <li>Device/browser type</li>
                <li>IP address (or approximate location derived from it)</li>
                <li>Log data (security, diagnostics)</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4 mb-1">D. Weather / Context Data</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>City or location information you provide (or approximate location if enabled by you)</li>
                <li>Weather conditions used for styling recommendations</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4 mb-1">E. Google Calendar Data (only if you connect Google)</h3>
              <p className="mt-1">If you choose to connect your Google account, BURS may access:</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>calendar events</li>
                <li>event titles</li>
                <li>event start/end times</li>
                <li>event location (if included in the event)</li>
                <li>calendar metadata needed to display schedule context</li>
              </ul>
              <p className="mt-2">Google OAuth scope used (intended):<br /><code className="text-xs bg-muted px-1.5 py-0.5 rounded">https://www.googleapis.com/auth/calendar.readonly</code></p>
              <p className="mt-2">BURS does not request permission to create, edit, or delete your Google Calendar events.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">F. Payment and Billing Data</h3>
              <p>Payments are processed by third-party payment providers (for example, Stripe). We do not store full card numbers. We may receive limited billing data such as:</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>payment status</li>
                <li>subscription renewal status</li>
                <li>transaction IDs</li>
                <li>billing country</li>
                <li>partial payment method metadata (as provided by the processor)</li>
              </ul>
            </section>

            {/* 4 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. How We Use Your Data</h2>
              <p>We use personal data to operate BURS and provide the features you expect.</p>
              <p className="mt-3">We use your data to:</p>

              <h3 className="font-medium text-foreground mt-3 mb-1">1. Provide the core Service</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>create and manage your account</li>
                <li>store your wardrobe</li>
                <li>generate outfit recommendations</li>
              </ul>

              <h3 className="font-medium text-foreground mt-3 mb-1">2. Power AI styling features</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>analyze clothing photos and attributes</li>
                <li>personalize outfit suggestions</li>
                <li>improve recommendations for your account</li>
              </ul>

              <h3 className="font-medium text-foreground mt-3 mb-1">3. Provide contextual recommendations</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>use weather context</li>
                <li>use calendar context (if connected) to suggest appropriate outfits</li>
              </ul>

              <h3 className="font-medium text-foreground mt-3 mb-1">4. Manage subscriptions and payments</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>process premium access</li>
                <li>handle billing events</li>
                <li>prevent fraud and abuse</li>
              </ul>

              <h3 className="font-medium text-foreground mt-3 mb-1">5. Support and troubleshoot</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>respond to support requests</li>
                <li>fix bugs</li>
                <li>improve reliability and security</li>
              </ul>

              <h3 className="font-medium text-foreground mt-3 mb-1">6. Comply with legal obligations</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>accounting/bookkeeping</li>
                <li>legal requests</li>
                <li>security investigations</li>
              </ul>
            </section>

            {/* 5 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Legal Bases for Processing (GDPR)</h2>
              <p>Under the GDPR, we process personal data only when we have a legal basis.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">A. Contract (Article 6(1)(b))</h3>
              <p>We process data as necessary to provide the Service you requested, including:</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>account creation and login</li>
                <li>wardrobe storage</li>
                <li>outfit generation</li>
                <li>subscription access</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4 mb-1">B. Consent (Article 6(1)(a))</h3>
              <p>We rely on consent for:</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>connecting your Google Calendar</li>
                <li>optional location-based features (where applicable)</li>
                <li>any optional data use that is not strictly necessary to provide BURS</li>
              </ul>
              <p className="mt-2">You can withdraw consent at any time (see Section 11).</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">C. Legitimate Interests (Article 6(1)(f))</h3>
              <p>We process some data for our legitimate interests, including:</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>service security</li>
                <li>fraud prevention</li>
                <li>debugging and performance monitoring</li>
                <li>improving the Service using aggregated or de-identified analytics</li>
              </ul>
              <p className="mt-2">When we rely on legitimate interests, we balance those interests against your rights and freedoms.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">D. Legal Obligation (Article 6(1)(c))</h3>
              <p>We process data when required to comply with legal obligations, including accounting, tax, and lawful requests by authorities.</p>
            </section>

            {/* 6 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Google API Services User Data (Important)</h2>
              <p>If you connect Google Calendar, BURS accesses Google user data only to provide the calendar-aware styling functionality you explicitly enable.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">Google User Data — What We Access</h3>
              <p>BURS accesses Google Calendar data on a read-only basis to:</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>understand your day's schedule</li>
                <li>identify event timing/context</li>
                <li>suggest suitable outfits based on your calendar and weather</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4 mb-1">Google User Data — What We Do NOT Do</h3>
              <p>BURS does not:</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>create, edit, or delete Google Calendar events</li>
                <li>sell Google user data</li>
                <li>use Google user data for advertising</li>
                <li>use Google user data for retargeting or personalized ads</li>
                <li>transfer Google user data to data brokers</li>
                <li>use Google user data for credit/lending decisions</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4 mb-1">Limited Use Commitment</h3>
              <p>BURS's use and transfer of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
              <p className="mt-2">This means:</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>Google user data is used only for user-facing features clearly shown in BURS</li>
                <li>humans do not access Google user data except in limited, permitted cases (for example, security, legal compliance, or with your explicit consent)</li>
                <li>any transfer is limited to what is necessary to provide the feature, comply with law, or maintain security</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4 mb-1">If We Change Google Data Use</h3>
              <p>If we change how BURS accesses or uses Google user data, we will:</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>update this Privacy Policy</li>
                <li>update in-product disclosures</li>
                <li>ask for your consent again before using Google user data for a new purpose</li>
              </ul>
            </section>

            {/* 7 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. AI and Automated Recommendations</h2>
              <p>BURS uses AI/ML systems to generate wardrobe insights and outfit suggestions.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">Transparency Notice</h3>
              <p>When you use styling recommendations, you are interacting with AI-assisted features.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">How AI is used</h3>
              <p>AI may:</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>classify garment images</li>
                <li>infer clothing attributes</li>
                <li>rank outfit suggestions</li>
                <li>personalize recommendations based on your prior interactions</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4 mb-1">Human decision remains yours</h3>
              <p>BURS provides suggestions only. Final clothing choices are always made by you.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">No solely automated legal/significant decisions</h3>
              <p>BURS does not use AI to make decisions that produce legal effects or similarly significant effects on you (for example, employment, credit, or insurance decisions).</p>
            </section>

            {/* 8 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Sharing of Data</h2>
              <p>We do not sell your personal data.</p>
              <p className="mt-2">We share personal data only when necessary to operate BURS, and only with appropriate safeguards.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">Categories of recipients</h3>
              <ol className="list-decimal pl-6 space-y-1 mt-1">
                <li>Hosting / infrastructure providers (for example, databases, storage, backend hosting)</li>
                <li>Authentication and security providers (for login, fraud prevention, abuse monitoring)</li>
                <li>Payment processors (for subscription billing)</li>
                <li>Weather and contextual data providers (to support weather-aware recommendations)</li>
                <li>Google (when you connect Google Calendar)</li>
                <li>Professional advisors / authorities (if required) (lawyers, auditors, regulators, law enforcement)</li>
              </ol>
              <p className="mt-3">Where required, we use Data Processing Agreements (DPAs) or equivalent contractual safeguards with processors.</p>
            </section>

            {/* 9 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. International Data Transfers</h2>
              <p>We aim to process data in the European Economic Area (EEA) where possible.</p>
              <p className="mt-2">If personal data is transferred outside the EEA/UK, we use appropriate safeguards such as:</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>adequacy decisions</li>
                <li>Standard Contractual Clauses (SCCs)</li>
                <li>other lawful transfer mechanisms under GDPR</li>
              </ul>
              <p className="mt-2">You may contact us for more information about transfer safeguards.</p>
            </section>

            {/* 10 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">10. Data Security</h2>
              <p>We use technical and organizational measures designed to protect your personal data, including:</p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>encryption in transit (TLS)</li>
                <li>encryption at rest (where supported)</li>
                <li>access controls and least-privilege permissions</li>
                <li>authentication and audit logging</li>
                <li>monitoring, patching, and security reviews</li>
                <li>processor due diligence</li>
              </ul>
            </section>

            {/* 11 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">11. Your Rights (GDPR)</h2>
              <p>If you are in the EU/EEA (and in many cases elsewhere), you have rights regarding your personal data.</p>
              <p className="mt-2">You may have the right to:</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>access your personal data</li>
                <li>correct inaccurate data</li>
                <li>delete your data</li>
                <li>restrict processing</li>
                <li>object to certain processing</li>
                <li>data portability</li>
                <li>withdraw consent at any time (where processing is based on consent)</li>
                <li>lodge a complaint with a supervisory authority</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4 mb-1">Sweden (IMY)</h3>
              <p>If you are in Sweden, you can complain to the Swedish Authority for Privacy Protection (Integritetsskyddsmyndigheten, IMY).</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">How to exercise your rights</h3>
              <p>Email us at <a href="mailto:hello@burs.me" className="text-accent hover:underline">hello@burs.me</a>. We may need to verify your identity before completing your request.</p>
            </section>

            {/* 12 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">12. Data Retention</h2>
              <p>We keep personal data only as long as necessary for the purposes described in this Privacy Policy.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">Typical retention approach</h3>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>Account data: kept while your account is active</li>
                <li>Wardrobe content and preferences: kept until you delete them or delete your account</li>
                <li>Google Calendar data: processed for contextual recommendations; we avoid storing more than necessary and limit retention of cached calendar data</li>
                <li>Support and security logs: retained for a limited period as needed for support/security</li>
                <li>Billing records: retained as required by law/accounting rules</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4 mb-1">Account deletion</h3>
              <p>You can request account deletion by using in-app settings (if available) or emailing <a href="mailto:hello@burs.me" className="text-accent hover:underline">hello@burs.me</a>.</p>
            </section>

            {/* 13 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">13. Cookies and Similar Technologies</h2>
              <p>BURS may use cookies and similar technologies for login/session management, security, preferences, and analytics (if enabled).</p>
              <p className="mt-2">Where required by law, we will ask for your consent before using non-essential cookies or tracking technologies.</p>
            </section>

            {/* 14 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">14. Children's Privacy</h2>
              <p>BURS is not intended for children under 13.</p>
              <p className="mt-2">If we learn that we collected personal data from a child under 13 without valid parental consent, we will delete it.</p>
              <p className="mt-2">If you believe a child has provided personal data to BURS, contact us at <a href="mailto:hello@burs.me" className="text-accent hover:underline">hello@burs.me</a>.</p>
            </section>

            {/* 15 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">15. Changes to This Privacy Policy</h2>
              <p>We may update this Privacy Policy from time to time.</p>
              <p className="mt-2">If we make material changes, we will:</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>update the "Last updated" date</li>
                <li>provide notice in the app or on the website</li>
                <li>request consent again where required (especially for new Google user data uses)</li>
              </ul>
            </section>

            {/* 16 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">16. Contact</h2>
              <p>Burs<br />Email: <a href="mailto:hello@burs.me" className="text-accent hover:underline">hello@burs.me</a></p>
            </section>

          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60">
          <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col items-center gap-4 text-xs text-muted-foreground">
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-foreground font-medium text-foreground">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
              <Link to="/contact" className="hover:text-foreground">Contact</Link>
            </div>
            <p>© {new Date().getFullYear()} BURS. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
