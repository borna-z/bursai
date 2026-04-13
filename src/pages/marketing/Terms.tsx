import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Scale } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE_CURVE, DURATION_MEDIUM } from '@/lib/motion';
import { PageHeader } from '@/components/layout/PageHeader';

export default function Terms() {
  const prefersReduced = useReducedMotion();

  const fadeUp = (delay = 0) =>
    prefersReduced
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: DURATION_MEDIUM, ease: EASE_CURVE },
        };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Helmet>
        <title>Terms of Use for BURS</title>
        <meta name="description" content="Terms of Use for BURS — acceptance, subscriptions, AI features, and governing law." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://burs.me/terms" />
      </Helmet>

      <PageHeader title="Terms of Use" showBack />

      {/* Content */}
      <main className="flex-1 max-w-xl mx-auto px-4 py-10 w-full">
        {/* Hero */}
        <motion.div className="text-center mb-10" {...fadeUp(0)}>
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-6 rounded-[1.25rem] border border-border/40">
            <Scale className="w-7 h-7 text-muted-foreground/50" />
          </div>
          <p className="label-editorial text-muted-foreground/60 mb-2">Legal</p>
          <h1 className="font-display italic text-[1.8rem] leading-tight mb-3">
            Terms of Use
          </h1>
          <p className="text-sm text-muted-foreground">Effective 25 February 2026</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Last updated: 25 February 2026</p>
        </motion.div>

        {/* Legal content card */}
        <motion.div
          className="rounded-[1.25rem] p-5 md:p-8 border border-border/40"
          {...fadeUp(0.08)}
        >
          <div className="space-y-10 text-[15px] leading-relaxed text-muted-foreground">

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">1. Acceptance of Terms</h2>
              <p>These Terms of Use ("Terms") govern your use of BURS (the "Service"), including burs.me and any related web app, mobile web app, or features.</p>
              <p className="mt-3">By accessing or using BURS, you agree to these Terms. If you do not agree, do not use the Service.</p>
              <p className="mt-3">If you use BURS on behalf of a company or organization, you confirm that you are authorized to accept these Terms on its behalf.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">2. Who We Are</h2>
              <p>BURS is provided by:</p>
              <p className="mt-2">Burs<br />Email: <a href="mailto:hello@burs.me" className="hover:underline text-foreground">hello@burs.me</a></p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">3. Eligibility</h2>
              <p>You must be at least 18 years old (or the age of legal majority in your country) to create an account and use paid features.</p>
              <p className="mt-3">If you are under 18, you may only use BURS with permission from a parent or legal guardian, and only where permitted by applicable law.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">4. Description of the Service</h2>
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

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">5. Accounts and Security</h2>
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

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">6. Subscription Plans, Billing, and Renewal</h2>
              <p>BURS may offer free and paid subscription plans.</p>

              <h3 className="font-medium mt-4 mb-1 text-foreground">Free plan</h3>
              <p>A free tier may include limited features or usage limits.</p>

              <h3 className="font-medium mt-4 mb-1 text-foreground">Paid plans (Premium)</h3>
              <p>Paid plans may include expanded storage, unlimited or higher usage limits, and advanced features (including optional calendar integration).</p>

              <h3 className="font-medium mt-4 mb-1 text-foreground">Billing</h3>
              <p>If you purchase a paid plan:</p>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>you authorize us (and our payment processor) to charge your selected payment method</li>
                <li>subscriptions may renew automatically unless canceled before the renewal date</li>
                <li>pricing, billing intervals, and taxes are shown at checkout or in the app</li>
              </ul>

              <h3 className="font-medium mt-4 mb-1 text-foreground">Cancellation</h3>
              <p>You can cancel your subscription at any time. Cancellation usually takes effect at the end of your current paid billing period unless otherwise stated at checkout.</p>

              <h3 className="font-medium mt-4 mb-1 text-foreground">Refunds</h3>
              <p>Fees are generally non-refundable except where required by law or where we expressly state otherwise.</p>

              <h3 className="font-medium mt-4 mb-1 text-foreground">Price changes</h3>
              <p>We may change pricing in the future. If we do, we will give notice before the new price applies to your next billing cycle.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">7. EU Consumer Rights (if applicable)</h2>
              <p>If you are a consumer in the EU/EEA, you may have mandatory rights under consumer law that cannot be limited by these Terms.</p>
              <p className="mt-3">For digital services, your right of withdrawal may be affected if:</p>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>you request immediate access to premium features, and</li>
                <li>you acknowledge that your withdrawal right may end once digital service delivery begins</li>
              </ul>
              <p className="mt-3">Any mandatory statutory rights remain unaffected.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">8. Third-Party Services and Google Calendar Integration</h2>
              <p>BURS may integrate with third-party services such as Google Calendar and weather providers.</p>

              <h3 className="font-medium mt-4 mb-1 text-foreground">Google Calendar</h3>
              <p>If you connect Google Calendar:</p>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>you authorize BURS to access your calendar data on a read-only basis</li>
                <li>BURS does not create, edit, or delete your calendar events</li>
                <li>you can revoke access anytime in your Google account permissions or in BURS settings (if available)</li>
              </ul>
              <p className="mt-3">Your use of Google services is also subject to Google's terms and privacy policies.</p>

              <h3 className="font-medium mt-4 mb-1 text-foreground">Third-party availability</h3>
              <p>We are not responsible for outages, changes, or errors caused by third-party services outside our control.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">9. Acceptable Use</h2>
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

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">10. Your Content</h2>

              <h3 className="font-medium mt-3 mb-1 text-foreground">Ownership</h3>
              <p>You retain ownership of the content you upload to BURS, including clothing photos and wardrobe metadata ("User Content").</p>

              <h3 className="font-medium mt-4 mb-1 text-foreground">License to BURS</h3>
              <p>To operate the Service, you grant us a non-exclusive, worldwide, royalty-free license to host, store, process, display, and analyze your User Content solely for the purpose of providing and improving BURS in accordance with our Privacy Policy.</p>

              <h3 className="font-medium mt-4 mb-1 text-foreground">Your responsibility</h3>
              <p>You confirm that you have the rights needed to upload your content, your content does not violate laws or third-party rights, and your content does not include prohibited material.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">11. Intellectual Property</h2>
              <p>BURS and its underlying software, design, AI systems, branding, and content (excluding your User Content) are owned by or licensed to us and protected by intellectual property laws.</p>
              <p className="mt-3">These Terms do not transfer any ownership rights to you.</p>
              <p className="mt-3">You may not copy, sell, sublicense, or commercially exploit BURS except as expressly permitted by us in writing.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">12. AI Features and Output Disclaimer</h2>
              <p>BURS uses AI and machine learning to generate recommendations and insights.</p>
              <p className="mt-3">By using BURS, you understand and agree that:</p>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>AI-generated suggestions may be imperfect, incomplete, or unsuitable</li>
                <li>outfit recommendations are for informational/personal use only</li>
                <li>you remain solely responsible for final decisions and how you use the recommendations</li>
              </ul>
              <p className="mt-3">BURS does not provide medical, legal, or professional advice.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">13. Privacy</h2>
              <p>Your use of BURS is also governed by our <Link to="/privacy" className="hover:underline text-foreground cursor-pointer">Privacy Policy</Link>.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">14. Service Availability and Changes</h2>
              <p>We aim to provide a reliable service, but we do not guarantee uninterrupted availability.</p>
              <p className="mt-3">We may modify features, release updates, perform maintenance, or suspend access temporarily for security or technical reasons.</p>
              <p className="mt-3">We may discontinue parts of the Service with reasonable notice where practical.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">15. Termination</h2>

              <h3 className="font-medium mt-3 mb-1 text-foreground">By you</h3>
              <p>You may stop using BURS at any time and may delete your account subject to our Privacy Policy and legal retention obligations.</p>

              <h3 className="font-medium mt-4 mb-1 text-foreground">By us</h3>
              <p>We may suspend or terminate your access if you violate these Terms, your use creates legal or security risk, required by law, or needed to protect BURS, users, or third parties.</p>
              <p className="mt-2">If possible, we will provide notice, unless doing so would create legal or security risk.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">16. Disclaimer of Warranties</h2>
              <p>To the maximum extent permitted by law, BURS is provided on an "as is" and "as available" basis.</p>
              <p className="mt-3">We do not guarantee that the Service will always be uninterrupted or error-free, AI outputs will always be accurate or suitable, or third-party integrations will always be available.</p>
              <p className="mt-3">Nothing in these Terms limits warranties or rights that cannot be excluded under applicable law.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">17. Limitation of Liability</h2>
              <p>To the maximum extent permitted by law, BURS and its affiliates, officers, employees, and contractors are not liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits, loss of data, or business interruption.</p>
              <p className="mt-3">Our total liability for claims arising out of or related to the Service is limited to the total amount you paid to BURS in the 12 months before the event giving rise to the claim.</p>

              <h3 className="font-medium mt-4 mb-1 text-foreground">Exceptions</h3>
              <p>Nothing in these Terms excludes or limits liability where such exclusion is not allowed by law.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">18. Changes to These Terms</h2>
              <p>We may update these Terms from time to time.</p>
              <p className="mt-3">If we make material changes, we will provide notice (for example, in-app or by email). Continued use of BURS after the updated Terms take effect means you accept the updated Terms.</p>
              <p className="mt-3">If you do not agree, you must stop using the Service.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">19. Governing Law and Disputes</h2>
              <p>These Terms are governed by the laws of Sweden, without regard to conflict-of-law rules.</p>
              <p className="mt-3">If you are a consumer in the EU/EEA, you may also benefit from mandatory protections in the country where you live.</p>
              <p className="mt-3">Any dispute that cannot be resolved informally will be handled by the competent courts of Sweden, unless mandatory consumer law provides otherwise.</p>
            </section>

            <section>
              <h2 className="font-display italic text-[1.3rem] leading-tight text-foreground mb-3">20. Contact</h2>
              <p>Burs<br />Email: <a href="mailto:hello@burs.me" className="hover:underline text-foreground">hello@burs.me</a></p>
            </section>

          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-6">
        <div className="max-w-xl mx-auto px-4 py-8 flex flex-col items-center gap-4 text-xs text-muted-foreground">
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-foreground transition-colors cursor-pointer">Privacy Policy</Link>
            <span className="font-medium text-foreground">Terms of Use</span>
            <a href="mailto:privacy@burs.se" className="hover:text-foreground transition-colors cursor-pointer">Contact</a>
          </div>
          <p>&copy; {new Date().getFullYear()} BURS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
