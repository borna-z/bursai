// English dictionary for the mobile app's acquisition flow.
// Append-only — same convention as the web's locale files. Keys are
// dot-namespaced by feature; do not reorganize once shipped.

export const en: Record<string, string> = {
  // ─── Splash ─────────────────────────────────────────────────────────────
  'splash.wordmark': 'BURS',
  'splash.tagline': 'Your wardrobe. Understood.',

  // ─── Auth ───────────────────────────────────────────────────────────────
  'auth.wordmark': 'BURS',
  'auth.signIn.eyebrow': 'Welcome back',
  'auth.signUp.eyebrow': 'Create your account',
  'auth.field.name': 'Full name',
  'auth.field.email': 'Email',
  'auth.field.password': 'Password',
  'auth.forgotPassword': 'Forgot password?',
  'auth.signIn.cta': 'Sign in',
  'auth.signUp.cta': 'Create account',
  'auth.signUp.terms': 'By continuing you agree to our Terms',
  'auth.divider.or': 'or',
  'auth.google': 'Continue with Google',
  'auth.toggle.haveAccount': 'Already have an account?',
  'auth.toggle.noAccount': "Don't have an account?",
  'auth.toggle.toSignIn': 'Sign in',
  'auth.toggle.toSignUp': 'Sign up',
  'auth.signIn.errorTitle': 'Sign in failed',
  'auth.signUp.errorTitle': 'Sign up failed',
  'auth.google.errorTitle': 'Google sign in failed',
  'auth.error.nameRequired': 'Please enter your name.',
  'auth.error.emailInvalid': 'Enter a valid email address.',
  'auth.error.passwordShort': 'Password must be at least 6 characters.',

  // ─── Onboarding shell ───────────────────────────────────────────────────
  'onboarding.back': 'Back',
  'onboarding.skip': 'Skip',

  // ─── Step 1 — Language ──────────────────────────────────────────────────
  'language.eyebrow': 'Welcome to BURS',
  'language.title': 'Choose your language',
  'language.continue': 'Continue',

  // ─── Step 2 — Value proposition ─────────────────────────────────────────
  'value.slide.wardrobe.eyebrow': 'Your wardrobe',
  'value.slide.wardrobe.title': 'Know every piece you own',
  'value.slide.wardrobe.body': 'Scan and catalog your entire wardrobe with AI tagging in minutes.',
  'value.slide.styling.eyebrow': 'Daily styling',
  'value.slide.styling.title': 'Get dressed with intention',
  'value.slide.styling.body': 'AI outfit suggestions tailored to your style, the weather, and your plans.',
  'value.slide.stylist.eyebrow': 'Your stylist',
  'value.slide.stylist.title': 'Always in your pocket',
  'value.slide.stylist.body': "Chat with your AI stylist anytime — it knows your wardrobe and your taste.",
  'value.styling.weatherChip': '14°',
  'value.styling.occasionChip': 'Coffee meeting',
  'value.stylist.chatExample': 'For the brunch tomorrow — pair your cream blouse with the navy chinos and the leather loafers.',
  'value.stylist.userExample': 'What about for dinner?',
  'value.stylist.knowsCount': 'Knows your 64 pieces',
  'value.cta.continue': 'Continue',
  'value.cta.begin': "Let's begin",

  // ─── Step 3 — Style quiz ────────────────────────────────────────────────
  'quiz.questionCounter': 'Question {q} of {total}',
  'quiz.cta.back': 'Back',
  'quiz.cta.next': 'Next',
  'quiz.cta.finish': 'Finish',
  // Q1
  'quiz.q1.title': 'A bit about you',
  'quiz.q1.body': 'Helps us tailor fit and silhouette.',
  'quiz.q1.gender.label': 'Gender',
  'quiz.q1.gender.woman': 'Woman',
  'quiz.q1.gender.man': 'Man',
  'quiz.q1.gender.nonbinary': 'Non-binary',
  'quiz.q1.gender.undisclosed': 'Prefer not to say',
  'quiz.q1.height.label': 'Height',
  'quiz.q1.height.cm': 'cm',
  'quiz.q1.height.decrease': 'Decrease height',
  'quiz.q1.height.increase': 'Increase height',
  // Q2
  'quiz.q2.title': 'How is your week split?',
  'quiz.q2.body': 'Drag a bar to set its share. The rest re-balance to 100%.',
  'quiz.q2.label.work': 'Work',
  'quiz.q2.label.social': 'Social',
  'quiz.q2.label.active': 'Active',
  'quiz.q2.label.home': 'Home',
  'quiz.q2.label.travel': 'Travel',
  'quiz.q2.total': 'Total',
  'quiz.q2.percentLabel': '{label} percentage',
  'quiz.q2.action.increase': 'Increase',
  'quiz.q2.action.decrease': 'Decrease',
  // Q3
  'quiz.q3.title': 'Where do you dress?',
  'quiz.q3.body': 'Helps weight outerwear, fabrics, and weather-aware suggestions.',
  'quiz.q3.climate.label': 'Climate',
  'quiz.q3.climate.hot': 'Hot',
  'quiz.q3.climate.warm': 'Warm',
  'quiz.q3.climate.mild': 'Mild',
  'quiz.q3.climate.cold': 'Cold',
  'quiz.q3.climate.variable': 'Variable',
  'quiz.q3.city.label': 'City',
  'quiz.q3.city.placeholder': 'Your city',
  // Q4
  'quiz.q4.title': 'Pick your style words',
  'quiz.q4.eyebrow.range': 'Pick {min}–{max}',
  'quiz.q4.eyebrow.count': '{count} selected',
  'quiz.q4.archetype.minimal': 'Minimal',
  'quiz.q4.archetype.classic': 'Classic',
  'quiz.q4.archetype.romantic': 'Romantic',
  'quiz.q4.archetype.street': 'Street',
  'quiz.q4.archetype.bohemian': 'Bohemian',
  'quiz.q4.archetype.preppy': 'Preppy',
  'quiz.q4.archetype.elegant': 'Elegant',
  'quiz.q4.archetype.edgy': 'Edgy',
  'quiz.q4.archetype.coastal': 'Coastal',
  'quiz.q4.archetype.sporty': 'Sporty',
  'quiz.q4.archetype.avantgarde': 'Avant-garde',
  'quiz.q4.archetype.workwear': 'Workwear',
  // Q5
  'quiz.q5.title': 'What should BURS do for you?',
  'quiz.q5.goal.fasterDressing.label': 'Get dressed faster',
  'quiz.q5.goal.fasterDressing.caption': 'A clear pick every morning, no decision fatigue.',
  'quiz.q5.goal.discoverCombos.label': 'Discover new combinations',
  'quiz.q5.goal.discoverCombos.caption': "Pairings you wouldn't have tried on your own.",
  'quiz.q5.goal.shopSmarter.label': 'Shop smarter',
  'quiz.q5.goal.shopSmarter.caption': 'Fill the real gaps in your wardrobe — not the imagined ones.',
  'quiz.q5.goal.capsuleWardrobe.label': 'Build a capsule wardrobe',
  'quiz.q5.goal.capsuleWardrobe.caption': 'Fewer pieces, more outfits, on purpose.',

  // ─── Step 4 — Studio selection ──────────────────────────────────────────
  'studio.eyebrow': 'Your studio',
  'studio.title': 'Choose your presentation',
  'studio.body': 'How should BURS display your garments?',
  'studio.recommended': 'Recommended',
  'studio.option.ghost.title': 'Ghost mannequin',
  'studio.option.ghost.caption': 'Professional invisible body form.',
  'studio.option.flat.title': 'Flat lay',
  'studio.option.flat.caption': 'Clean flat surface photography.',
  'studio.option.hanger.title': 'Hanger',
  'studio.option.hanger.caption': 'Classic hanging display.',
  'studio.continue': 'Continue',

  // ─── Step 5 — Achievement ───────────────────────────────────────────────
  'achievement.eyebrow': "You're all set",
  'achievement.title': 'Your 3-day trial starts now',
  'achievement.body': 'Full access to every feature.',
  'achievement.feature.unlimited': 'Unlimited outfit generation',
  'achievement.feature.chat': 'AI style chat — always in context',
  'achievement.feature.studio': 'Ghost mannequin studio rendering',
  'achievement.cta': 'Start styling',
  'achievement.restore.prompt': 'Already subscribed?',
  'achievement.restore.link': 'Restore',
  'achievement.restore.label': 'Restore previous subscription',

  // ─── Step 6 — Reveal ────────────────────────────────────────────────────
  'reveal.eyebrow': 'Your first look',
  'reveal.title': 'Based on your style',
  'reveal.loading': 'Generating your first outfit…',
  'reveal.tagline': 'This is just the beginning.',
  'reveal.cta': 'Go to my wardrobe',
  'reveal.outfit.name': 'First impressions',
  'reveal.outfit.sub': 'Your first look',

  // ─── Paywall ────────────────────────────────────────────────────────────
  'paywall.close': 'Close',
  'paywall.eyebrow': 'Unlock BURS',
  'paywall.title': 'Your personal stylist, always with you',
  'paywall.feature.unlimited.title': 'Unlimited outfit generation',
  'paywall.feature.unlimited.caption': 'Every occasion, every mood, every day.',
  'paywall.feature.chat.title': 'AI style chat — always in context',
  'paywall.feature.chat.caption': 'Knows your wardrobe and your taste.',
  'paywall.feature.studio.title': 'Ghost mannequin studio rendering',
  'paywall.feature.studio.caption': 'Editorial-grade product photos in seconds.',
  'paywall.feature.travel.title': 'Travel capsule + wardrobe gaps',
  'paywall.feature.travel.caption': 'Pack for any trip; shop only what fills a gap.',
  'paywall.plan.monthly': 'Monthly',
  'paywall.plan.yearly': 'Yearly',
  'paywall.plan.savings': 'Save {pct}%',
  'paywall.price.monthly': '119 SEK',
  'paywall.price.yearly': '899 SEK',
  'paywall.price.perMonth': 'per month',
  'paywall.price.perYear': 'per year',
  'paywall.cta': 'Start 3-day free trial',
  'paywall.trial.monthly': '3 days free, then 119 SEK / month',
  'paywall.trial.yearly': '3 days free, then 899 SEK / year, billed annually',
  'paywall.restore': 'Restore purchase',
  'paywall.restore.label': 'Restore previous subscription',
  'paywall.restore.alertTitle': 'Restore purchase',
  'paywall.restore.alertBody': 'No previous subscription found. If you believe this is wrong, contact support.',
  'paywall.restore.alertOk': 'OK',
  'paywall.terms': 'Terms',
  'paywall.terms.label': 'Open terms of service',
  'paywall.privacy': 'Privacy',
  'paywall.privacy.label': 'Open privacy policy',
  'paywall.linkError.title': 'Could not open link',

  // M11 — typed-confirm modal chrome (used by every destructive flow).
  // Title / body / required-text / confirm-label come from the caller
  // so each flow can localize its own scenario, but the modal chrome
  // (eyebrow, instruction, cancel, pending) is shared.
  'confirmModal.eyebrow': 'Are you sure?',
  'confirmModal.instruction': 'Type {required} to confirm.',
  'confirmModal.cancel': 'Cancel',
  'confirmModal.pending': 'Working…',

  // M11 — destructive mutations (account deletion + reset style memory).
  // App Store guideline 5.1.1(v) gates the delete path; the typed-confirm
  // copy mirrors web's PR #712 clickjacking-mitigation strings.
  'settings.delete_account.title': 'Delete account',
  'settings.delete_account.body':
    'This permanently removes your wardrobe, outfits, and learned style — every photo, every signal, every preference. This cannot be undone.',
  'settings.delete_account.confirm': 'Delete account',
  'settings.delete_account.required': 'DELETE',
  'settings.delete_account.error': 'Could not delete your account. Please try again or contact support.',

  'settings.reset_memory.title': 'Reset style memory',
  'settings.reset_memory.body':
    'BURS will forget what it has learned about your taste — saves, swaps, ratings, never-suggest pins. Your wardrobe and outfits stay.',
  'settings.reset_memory.confirm': 'Reset memory',
  'settings.reset_memory.required': 'RESET',
  'settings.reset_memory.success.title': 'Style memory cleared',
  'settings.reset_memory.success.body':
    'BURS will start fresh on your next session.',
  'settings.reset_memory.error': 'Could not reset style memory. Please try again.',

  // M4 — duplicate detection. en-only for now; sv (and the other 8 locales)
  // land with M33 i18n.
  'addpiece.duplicate.eyebrow': 'Duplicate?',
  'addpiece.duplicate.title': 'Already in your wardrobe?',
  'addpiece.duplicate.body': 'This looks a lot like {title} — you may already own it.',
  'addpiece.duplicate.bodyNoTitle': 'This looks a lot like a piece you already own.',
  'addpiece.duplicate.viewExisting': 'View existing',
  'addpiece.duplicate.addAnyway': 'Add anyway',

  // M12 — password reset + deep links.
  'auth.resetPassword.emailRequiredTitle': 'Email required',
  'auth.resetPassword.emailRequiredBody':
    'Enter the email for your account, then tap “Forgot password?” again.',
  'auth.resetPassword.errorTitle': "We couldn't send the reset email",
  'auth.resetPassword.successTitle': 'Check your email',
  'auth.resetPassword.successBody':
    'We sent a reset link to {email}. It expires in 1 hour.',
  'resetPassword.title': 'Set a new password',
  'resetPassword.eyebrow': 'New password',
  'resetPassword.intro': 'Choose a new password to sign in with.',
  'resetPassword.newPasswordLabel': 'New password',
  'resetPassword.confirmPasswordLabel': 'Confirm password',
  'resetPassword.cta': 'Update password',
  'resetPassword.submitting': 'Updating…',
  'resetPassword.errorTitle': "We couldn't update your password",
  'resetPassword.successTitle': 'Password updated',
  'resetPassword.successBody': 'Your password has been changed.',
  'resetPassword.tooShort': 'Password must be at least 6 characters.',
  'resetPassword.mismatch': 'Passwords do not match.',
  'resetPassword.back': 'Back',

  // M13 — outfit anchor locking + rules engine.
  'anchor.makeAnchor.title': 'Make this the anchor',
  'anchor.makeAnchor.body': 'Generate a new outfit anchored on {title}?',
  'anchor.makeAnchor.bodyFallback': 'Generate a new outfit anchored on this piece?',
  'anchor.makeAnchor.cancel': 'Cancel',
  'anchor.makeAnchor.confirm': 'Make anchor',
  'anchor.locked.eyebrow': 'Anchor locked',
  'anchor.missed.eyebrow': 'Anchor not honoured',
  'anchor.locked.fallback': 'Selected piece',
  'anchor.missed.errorTitle': "Couldn't build around the anchor",
  'anchor.missed.errorBody':
    "We couldn't build a complete outfit around {title}. Try again or pick a different anchor.",
  'anchor.missed.errorBodyFallback':
    "We couldn't build a complete outfit around the locked piece. Try again or pick a different anchor.",
  'anchor.removeAnchor': 'Remove anchor',
  'outfit.invalid.eyebrow': 'Outfit incomplete',
  'outfit.invalid.errorTitle': "We couldn't build a complete outfit",
  'outfit.invalid.errorBody':
    "The pieces returned didn't add up to a wearable look. Try again or add more garments to your wardrobe.",
};
