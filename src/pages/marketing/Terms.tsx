import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import bursLogo from '@/assets/burs-monogram.png';

export default function Terms() {
  return (
    <div style={{ background: '#F5F0E8', color: '#1C1917' }}>
      <Helmet>
        <title>Terms of Use for BURS</title>
        <meta name="description" content="Terms of Use for BURS — acceptance, subscriptions, AI features, and governing law." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://burs.me/terms" />
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
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#1C1917' }}>Terms of Use for BURS</h1>
          <p className="mb-2" style={{ color: '#6B6560' }}>Effective date: 25 February 2026</p>
          <p className="mb-10" style={{ color: '#6B6560' }}>Last updated: 25 February 2026</p>

          <div className="space-y-10 text-[15px] leading-relaxed" style={{ color: '#6B6560' }}>

            {/* 1 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
              <p>These Terms of Use ("Terms") govern your use of BURS (the "Service"), including burs.me and any related web app, mobile web app, or features.</p>
              <p className="mt-3">By accessing or using BURS, you agree to these Terms. If you do not agree, do not use the Service.</p>
              <p className="mt-3">If you use BURS on behalf of a company or organization, you confirm that you are authorized to accept these Terms on its behalf.</p>
            </section>

            {/* 2 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Who We Are</h2>
              <p>BURS is provided by:</p>
              <p className="mt-2">Burs<br />Email: <a href="mailto:hello@burs.me" className="text-accent hover:underline">hello@burs.me</a></p>
            </section>

            {/* 3 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Eligibility</h2>
              <p>You must be at least 18 years old (or the age of legal majority in your country) to create an account and use paid features.</p>
              <p className="mt-3">If you are under 18, you may only use BURS with permission from a parent or legal guardian, and only where permitted by applicable law.</p>
            </section>

            {/* 4 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Description of the Service</h2>
              <p>BURS is an AI-assisted digital wardrobe and styling service that may include:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>wardrobe digitization (photo upload and tagging)</li>
                <li>outfit recommendations</li>
                <li>style planning and tracking</li>
                <li>weather-aware suggestions</li>
                <li>optional calendar-aware suggestions (for example, via Google Calendar)</li>
                <li>premium subscription features</li>
              </ul>
              <p className="mt-3">BURS may update, improve, add, or remove features over time.</p>
            </section>

            {/* 5 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Accounts and Security</h2>
              <p>To use certain features, you must create an account.</p>
              <p className="mt-3">You agree to:</p>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>provide accurate and up-to-date information</li>
                <li>keep your login credentials secure</li>
                <li>notify us promptly of unauthorized use of your account</li>
              </ul>
              <p className="mt-3">You are responsible for activity that occurs under your account unless caused by our failure to use reasonable security measures.</p>
              <p className="mt-3">We may suspend or restrict access if we detect suspected fraud, abuse, or violations of these Terms.</p>
            </section>

            {/* 6 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Subscription Plans, Billing, and Renewal</h2>
              <p>BURS may offer free and paid subscription plans.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">Free plan</h3>
              <p>A free tier may include limited features or usage limits.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">Paid plans (Premium)</h3>
              <p>Paid plans may include expanded storage, unlimited or higher usage limits, and advanced features (including optional calendar integration).</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">Billing</h3>
              <p>If you purchase a paid plan:</p>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>you authorize us (and our payment processor) to charge your selected payment method</li>
                <li>subscriptions may renew automatically unless canceled before the renewal date</li>
                <li>pricing, billing intervals, and taxes are shown at checkout or in the app</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4 mb-1">Cancellation</h3>
              <p>You can cancel your subscription at any time. Cancellation usually takes effect at the end of your current paid billing period unless otherwise stated at checkout.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">Refunds</h3>
              <p>Fees are generally non-refundable except where required by law or where we expressly state otherwise.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">Price changes</h3>
              <p>We may change pricing in the future. If we do, we will give notice before the new price applies to your next billing cycle.</p>
            </section>

            {/* 7 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. EU Consumer Rights (if applicable)</h2>
              <p>If you are a consumer in the EU/EEA, you may have mandatory rights under consumer law that cannot be limited by these Terms.</p>
              <p className="mt-3">For digital services, your right of withdrawal may be affected if:</p>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>you request immediate access to premium features, and</li>
                <li>you acknowledge that your withdrawal right may end once digital service delivery begins</li>
              </ul>
              <p className="mt-3">Any mandatory statutory rights remain unaffected.</p>
            </section>

            {/* 8 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Third-Party Services and Google Calendar Integration</h2>
              <p>BURS may integrate with third-party services such as Google Calendar and weather providers.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">Google Calendar</h3>
              <p>If you connect Google Calendar:</p>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>you authorize BURS to access your calendar data on a read-only basis</li>
                <li>BURS does not create, edit, or delete your calendar events</li>
                <li>you can revoke access anytime in your Google account permissions or in BURS settings (if available)</li>
              </ul>
              <p className="mt-3">Your use of Google services is also subject to Google's terms and privacy policies.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">Third-party availability</h3>
              <p>We are not responsible for outages, changes, or errors caused by third-party services outside our control.</p>
            </section>

            {/* 9 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>use BURS for unlawful purposes</li>
                <li>upload illegal, harmful, or infringing content</li>
                <li>upload content you do not have rights to use</li>
                <li>attempt to reverse engineer or copy the Service (except where law allows)</li>
                <li>interfere with security or system integrity</li>
                <li>use bots, scraping, or automation that harms the Service</li>
                <li>misuse APIs or authentication systems</li>
                <li>use the Service in a way that violates third-party platform rules (including Google API rules)</li>
              </ul>
              <p className="mt-3">We may suspend or terminate accounts that violate these Terms.</p>
            </section>

            {/* 10 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">10. Your Content</h2>

              <h3 className="font-medium text-foreground mt-3 mb-1">Ownership</h3>
              <p>You retain ownership of the content you upload to BURS, including clothing photos and wardrobe metadata ("User Content").</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">License to BURS</h3>
              <p>To operate the Service, you grant us a non-exclusive, worldwide, royalty-free license to host, store, process, display, and analyze your User Content solely for the purpose of providing and improving BURS in accordance with our Privacy Policy.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">Your responsibility</h3>
              <p>You confirm that you have the rights needed to upload your content, your content does not violate laws or third-party rights, and your content does not include prohibited material.</p>
            </section>

            {/* 11 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">11. Intellectual Property</h2>
              <p>BURS and its underlying software, design, AI systems, branding, and content (excluding your User Content) are owned by or licensed to us and protected by intellectual property laws.</p>
              <p className="mt-3">These Terms do not transfer any ownership rights to you.</p>
              <p className="mt-3">You may not copy, sell, sublicense, or commercially exploit BURS except as expressly permitted by us in writing.</p>
            </section>

            {/* 12 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">12. AI Features and Output Disclaimer</h2>
              <p>BURS uses AI and machine learning to generate recommendations and insights.</p>
              <p className="mt-3">By using BURS, you understand and agree that:</p>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>AI-generated suggestions may be imperfect, incomplete, or unsuitable</li>
                <li>outfit recommendations are for informational/personal use only</li>
                <li>you remain solely responsible for final decisions and how you use the recommendations</li>
              </ul>
              <p className="mt-3">BURS does not provide medical, legal, or professional advice.</p>
            </section>

            {/* 13 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">13. Privacy</h2>
              <p>Your use of BURS is also governed by our <Link to="/privacy" className="text-accent hover:underline">Privacy Policy</Link>.</p>
            </section>

            {/* 14 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">14. Service Availability and Changes</h2>
              <p>We aim to provide a reliable service, but we do not guarantee uninterrupted availability.</p>
              <p className="mt-3">We may modify features, release updates, perform maintenance, or suspend access temporarily for security or technical reasons.</p>
              <p className="mt-3">We may discontinue parts of the Service with reasonable notice where practical.</p>
            </section>

            {/* 15 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">15. Termination</h2>

              <h3 className="font-medium text-foreground mt-3 mb-1">By you</h3>
              <p>You may stop using BURS at any time and may delete your account subject to our Privacy Policy and legal retention obligations.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">By us</h3>
              <p>We may suspend or terminate your access if you violate these Terms, your use creates legal or security risk, required by law, or needed to protect BURS, users, or third parties.</p>
              <p className="mt-2">If possible, we will provide notice, unless doing so would create legal or security risk.</p>
            </section>

            {/* 16 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">16. Disclaimer of Warranties</h2>
              <p>To the maximum extent permitted by law, BURS is provided on an "as is" and "as available" basis.</p>
              <p className="mt-3">We do not guarantee that the Service will always be uninterrupted or error-free, AI outputs will always be accurate or suitable, or third-party integrations will always be available.</p>
              <p className="mt-3">Nothing in these Terms limits warranties or rights that cannot be excluded under applicable law.</p>
            </section>

            {/* 17 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">17. Limitation of Liability</h2>
              <p>To the maximum extent permitted by law, BURS and its affiliates, officers, employees, and contractors are not liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits, loss of data, or business interruption.</p>
              <p className="mt-3">Our total liability for claims arising out of or related to the Service is limited to the total amount you paid to BURS in the 12 months before the event giving rise to the claim.</p>

              <h3 className="font-medium text-foreground mt-4 mb-1">Exceptions</h3>
              <p>Nothing in these Terms excludes or limits liability where such exclusion is not allowed by law.</p>
            </section>

            {/* 18 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">18. Changes to These Terms</h2>
              <p>We may update these Terms from time to time.</p>
              <p className="mt-3">If we make material changes, we will provide notice (for example, in-app or by email). Continued use of BURS after the updated Terms take effect means you accept the updated Terms.</p>
              <p className="mt-3">If you do not agree, you must stop using the Service.</p>
            </section>

            {/* 19 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">19. Governing Law and Disputes</h2>
              <p>These Terms are governed by the laws of Sweden, without regard to conflict-of-law rules.</p>
              <p className="mt-3">If you are a consumer in the EU/EEA, you may also benefit from mandatory protections in the country where you live.</p>
              <p className="mt-3">Any dispute that cannot be resolved informally will be handled by the competent courts of Sweden, unless mandatory consumer law provides otherwise.</p>
            </section>

            {/* 20 */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">20. Contact</h2>
              <p>Burs<br />Email: <a href="mailto:hello@burs.me" className="text-accent hover:underline">hello@burs.me</a></p>
            </section>

          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60">
          <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col items-center gap-4 text-xs text-muted-foreground">
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground font-medium text-foreground">Terms of Use</Link>
              <Link to="/contact" className="hover:text-foreground">Contact</Link>
            </div>
            <p>© {new Date().getFullYear()} BURS. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
