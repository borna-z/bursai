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

  // ─── Stylist chat (M14 — 8-mode chat contract) ─────────────────────────
  'chat.mode.ACTIVE_LOOK_REFINEMENT': 'Refinement',
  'chat.mode.GARMENT_FIRST_STYLING': 'Garment-first',
  'chat.mode.OUTFIT_GENERATION': 'Outfit',
  'chat.mode.WARDROBE_GAP_ANALYSIS': 'Wardrobe gap',
  'chat.mode.PURCHASE_PRIORITIZATION': 'Buy next',
  'chat.mode.STYLE_IDENTITY_ANALYSIS': 'Style identity',
  'chat.mode.LOOK_EXPLANATION': 'Why this look',
  'chat.mode.PLANNING': 'Plan',
  'chat.memory.section_title': 'Style memory',
  'chat.memory.forget_action': 'Forget',
  'chat.memory.empty': 'Burs is still learning your style.',
  'chat.active_look.title': 'Current look',
  'chat.active_look.clear': 'Clear',
  'chat.anchor.title': 'Anchor',
  'chat.anchor.clear': 'Clear anchor',
  'chat.title': 'Style Chat',
  'chat.eyebrow': 'AI',
  'chat.memory.toggle.show': 'Show',
  'chat.memory.toggle.hide': 'Hide',
  'chat.error.premium.title': 'Premium feature',
  'chat.error.premium.body':
    'Outfit chat is part of BURS Premium. Upgrade to keep generating looks.',
  'chat.anchor.set.title': 'Set anchor',
  'chat.anchor.set.body': "Use this look's main piece as your anchor for the next turn?",
  'chat.anchor.set.confirm': 'Set',
  'chat.anchor.set.cancel': 'Cancel',
  'chat.empty.title': 'Hi',
  'chat.empty.subtitle.unauth': 'Sign in to chat with your stylist.',
  'chat.empty.subtitle.auth': "Tell me what you're dressing for.",
  'chat.error.retry': 'Retry',
  'chat.composer.placeholder': 'Ask your stylist…',
  'chat.memory.disabled.title': 'Garment-level forget only',
  'chat.memory.disabled.body': 'Full memory edit lands in a future release.',
  'chat.memory.confirm.title': 'Stop suggesting?',
  'chat.memory.confirm.body.template': 'Stop suggesting "{label}"?',
  'chat.active_look.fallback.template': '{n} pieces',
  'chat.anchor.gesture.hint': "Long-press to anchor this look's main piece",

  // ─── Home — Smart Day Banner (M15) ─────────────────────────────────────
  'home.smartDay.eyebrowTemplate': '{weekday} · {context}',
  'home.smartDay.fallback.eyebrow': '{weekday}',
  'home.smartDay.fallback.title': 'Pick what feels right today.',
  'home.smartDay.tapHint': 'View this outfit',
  'home.smartDay.openHint': 'Opens outfit details',

  // ─── Outfit pool + week generator (M16) ────────────────────────────────
  'outfitPool.title': 'Outfit Pool',
  'outfitPool.progressTemplate': '{n} of {total} ready',
  'outfitPool.saveSelectedTemplate': 'Save selected ({n})',
  'outfitPool.generateMore': 'Generate more',
  'outfitPool.empty.title': 'No outfits generated',
  'outfitPool.empty.body':
    "We couldn't build any outfits this round. Try again or adjust your wardrobe.",
  'outfitPool.savedTemplate': '{n} saved',
  'outfitPool.partialSaveBody': '{failed} couldn\'t be saved — try again.',
  'weekPlan.title': 'Week plan',
  'weekPlan.generate': 'Generate week',
  'weekPlan.generating': 'Generating…',
  'weekPlan.progressTemplate': '{n}/{total}',
  'weekPlan.dayFailedTemplate': "Couldn't generate {day} — tap to retry",
  'weekPlan.swap': 'Tap to swap',
  // Surfaced by OutfitPoolScreen when every selected draft fails to
  // persist — pairs with `outfitPool.partialSaveBody` for the count.
  // Replaces the earlier "0 saved" title which was misleading on full
  // failure (M16 P2.5).
  'outfitPool.saveFailedTitle': "Couldn't save outfits",

  // ─── Composition helpers (M17) ─────────────────────────────────────────
  'outfitDetail.suggestAccessoriesAction': 'Suggest accessories',
  'outfitDetail.tryVariationsAction': 'Try variations',
  'outfitDetail.cloneDnaAction': 'Clone style',
  'outfitDetail.accessories.title': 'Accessories',
  'outfitDetail.accessories.empty':
    "We couldn't find accessories for this outfit.",
  'outfitDetail.accessories.addAction': 'Add to outfit',
  'outfitDetail.variations.title': 'Variations',
  'outfitDetail.variations.empty':
    "We couldn't build any variations from your wardrobe.",
  'outfitDetail.cloneDna.title': 'Cloned style',
  'outfitDetail.cloneDna.banner': 'A new outfit in the same style',
  'shareOutfit.generateFlatlay': 'Generate flatlay',
  'shareOutfit.generatingFlatlay': 'Generating flatlay…',
  'shareOutfit.flatlayError': "Couldn't generate flatlay",
  // M17 Codex P1.5 — surfaced when a flatlay path already exists; tapping the
  // button re-runs the generator with the same outfit. Distinct from
  // `shareOutfit.generateFlatlay` so the user knows the call will replace
  // their current rendered image.
  'shareOutfit.regenerateFlatlay': 'Regenerate flatlay',
  // M17 Codex P3.4 — disabled CTA copy when the user lands on ShareOutfit
  // without an outfit context (e.g. shallow deep link). Replaces the silent
  // "no button" branch so the screen always explains what's missing.
  'shareOutfit.openFromOutfit': 'Open from an outfit to generate flatlay',
  // M17 Codex P2.6 — fallback button label while the composition helpers are
  // mid-request. Distinct from the persistent action labels so the user
  // sees the call is in flight.
  'outfitDetail.helperLoading': 'Loading…',
  // M17 Codex P1.8 — refresh affordance inside the collapsible composition
  // sections. Aria/visual label for the small icon button.
  'outfitDetail.refreshAction': 'Refresh',

  // ─── Photo feedback / selfie comparison (M18) ──────────────────────────
  // Camera-first capture surface that compares a mirror selfie against an
  // outfit's garments. Entered from OutfitDetail or PlanScreen.
  'photoFeedback.eyebrow': 'Photo feedback',
  'photoFeedback.title': 'Photo feedback',
  'photoFeedback.tryOnAction': 'Try it on',
  'photoFeedback.captureCta': 'Capture',
  'photoFeedback.retake': 'Retake',
  'photoFeedback.confirm': 'Use this selfie',
  'photoFeedback.uploading': 'Uploading…',
  'photoFeedback.analyzing': 'Analyzing…',
  'photoFeedback.error': "We couldn't analyze that selfie. Try again.",
  'photoFeedback.fitNotes': 'Fit notes',
  'photoFeedback.colorCallouts': 'Color callouts',
  'photoFeedback.swapSuggestions': 'Swap suggestions',
  'photoFeedback.done': 'Done',
  'photoFeedback.overallTemplate': 'Overall · {score} / 10',
  'photoFeedback.hint': 'Stand in front of a mirror',
  'photoFeedback.cameraUnavailable': 'Camera available in device build',
  'photoFeedback.allowCamera': 'Allow camera',
  'photoFeedback.openSettings': 'Open Settings',
  'photoFeedback.captureFailedTitle': 'Capture failed',
  'photoFeedback.captureFailedBody': 'Try again.',
  'photoFeedback.close': 'Close',
  'photoFeedback.switchCamera': 'Switch camera',

  // ─── M19 — Visual Search (AddPiece third entry) ────────────────────────
  'visualSearch.title': 'Search by photo',
  'visualSearch.eyebrow': 'Visual search',
  'visualSearch.takePhoto': 'Take photo',
  'visualSearch.chooseFromLibrary': 'Choose from library',
  'visualSearch.searchCta': 'Search this look',
  'visualSearch.searching': 'Finding similar pieces…',
  'visualSearch.error': "We couldn't run that search. Try again.",
  'visualSearch.wardrobeRow': 'Your wardrobe',
  'visualSearch.webRow': 'Found online',
  'visualSearch.wardrobeEmpty': 'No wardrobe matches yet — try another reference.',
  'visualSearch.webEmpty': 'No online matches yet.',
  'visualSearch.webComingSoon': 'Online import coming soon',
  // M19 Codex round 1 P1.1 — accessibility hints for tappable surfaces
  // (SourcePill camera/library, WardrobeMatchTile, WebMatchTile, clear
  // reference button). Hints describe the action that follows the tap.
  'visualSearch.takePhotoHint': 'Opens the camera to take a reference photo',
  'visualSearch.chooseFromLibraryHint': 'Opens the gallery to pick a reference photo',
  'visualSearch.wardrobeMatchHint': 'Opens GarmentDetail',
  'visualSearch.wardrobeMatchLoadingHint': 'Loading garment — tap to open detail',
  'visualSearch.webMatchHint': 'Shows online product info',
  'visualSearch.clearReferenceHint': 'Removes the reference photo',
  'visualSearch.clearReferenceLabel': 'Clear reference',
  // M19 Codex round 1 P2.1 — surfaced when the resized reference base64
  // exceeds the inline-payload guard (≈ 2.25 MB binary).
  'visualSearch.imageTooLarge': 'Image too large — try a smaller photo',
  // M19 Codex round 1 P2.2 — translated copy for permission + capture
  // alert dialogs that previously held hardcoded English strings.
  'visualSearch.permission.cameraTitle': 'Permission needed',
  'visualSearch.permission.cameraBody': 'Camera access is required to take a reference photo.',
  'visualSearch.permission.galleryTitle': 'Permission needed',
  'visualSearch.permission.galleryBody': 'Photo library access is required to pick a reference image.',
  'visualSearch.permission.openSettings': 'Open settings',
  'visualSearch.permission.cancel': 'Cancel',
  'visualSearch.cameraUnavailableTitle': 'Camera unavailable',
  'visualSearch.cameraUnavailableBody': 'Could not capture a photo. Try again.',
  'visualSearch.galleryUnavailableTitle': 'Gallery unavailable',
  'visualSearch.galleryUnavailableBody': 'Could not pick a photo. Try again.',
  'visualSearch.webMatchOpenAction': 'Open',
  'visualSearch.cancel': 'Cancel',
  // M19 Codex round 1 P2.4 — surfaced when a web match's product_url
  // fails the https:// allowlist guard.
  'visualSearch.invalidWebUrl': 'This link is not safe to open.',
  // M19 Codex round 1 P3.4 — empty-row copy for the "Found online" row
  // pre-launch (online matches are not live yet). Replaces `webEmpty`
  // until the M20 product-search side lights up.
  'visualSearch.webComingSoonInline': 'Online matches coming soon',

  // ─── M20 — Import from link (AddPiece fourth entry) ────────────────────
  'importFromLink.eyebrow': 'Import',
  'importFromLink.title': 'Paste a link',
  'importFromLink.back': 'Back',
  'importFromLink.inputLabel': 'Product URLs',
  'importFromLink.inputHint': 'One link per line · we’ll fetch the product image and details',
  'importFromLink.placeholder': 'https://www.example.com/product\nhttps://www.example.com/another',
  'importFromLink.cta': 'Find pieces',
  // Placeholder pattern matches mobile's i18n shim — see lib/i18n.ts.
  'importFromLink.searching': 'Importing {current} of {total}…',
  'importFromLink.maxLinks': 'Max {max} links per import',
  'importFromLink.resultsHeading': 'Imports',
  'importFromLink.statusWaiting': 'Waiting',
  'importFromLink.statusImporting': 'Importing',
  'importFromLink.statusSuccess': 'Imported',
  'importFromLink.statusFailed': 'Failed',
  'importFromLink.openGarmentLabel': 'Open imported piece — {title}',
  'importFromLink.openGarmentHint': 'Opens the saved garment so you can refine its details',
  'importFromLink.allDone': '{success} imported · {failed} failed',
  'importFromLink.error.invalidUrl': 'Add at least one valid https:// link.',
  'importFromLink.error.noResults': 'None of the links could be imported. Try a different source.',
  'importFromLink.error.network': 'Could not reach the importer. Check your connection and try again.',
  'importFromLink.cancelTitle': 'Stop importing?',
  'importFromLink.cancelBody': 'The current batch is still in progress.',
  'importFromLink.cancelStay': 'Keep importing',
  'importFromLink.cancelLeave': 'Stop',

  // ─── M21 — Condition assessment (GarmentDetail entry) ──────────────────
  'condition.checkAction': 'Check condition',
  'condition.assessing': 'Assessing…',
  'condition.scoreLabel': 'Condition {score} / 100',
  'condition.tier.good': 'Good',
  'condition.tier.fair': 'Fair',
  'condition.tier.poor': 'Needs care',
  'condition.wearSignals': 'Wear signals',
  'condition.repairTitle': 'Repair recommendations',
  'condition.reassessAction': 'Re-assess',
  'condition.error.network': "Couldn't reach the assessor. Try again in a moment.",
  'condition.openHint': 'Opens the full condition breakdown',
  'condition.empty': 'No assessment yet.',
  'condition.closeSheet': 'Close condition details',

  // ─── M22 — Wardrobe aging panel (Insights) ─────────────────────────────
  'wardrobeAging.title': 'Wardrobe aging',
  'wardrobeAging.eyebrow': 'Rediscover',
  'wardrobeAging.bucket.aged': 'Showing wear',
  'wardrobeAging.bucket.unworn': 'Never worn',
  'wardrobeAging.bucket.retire': 'Retire candidates',
  'wardrobeAging.empty.title': 'Wardrobe is in great shape',
  'wardrobeAging.empty.body': 'Nothing flagged for retirement and every piece is in rotation.',
  'wardrobeAging.error.network': "Couldn't refresh aging insights. Pull to retry.",
  'wardrobeAging.openHint': 'Opens the full list of garments in this bucket',
  'wardrobeAging.countLabel': 'garments in bucket',

  // ─── M22 — UnusedGarmentsScreen (bucket detail) ────────────────────────
  'unusedGarments.title.aged': 'Showing wear',
  'unusedGarments.title.unworn': 'Never worn',
  'unusedGarments.title.retire': 'Retire candidates',
  'unusedGarments.empty': 'Nothing here yet',

  // ─── M23 — Shopping Chat (StyleChatScreen mode toggle + cards) ─────────
  'shoppingChat.modeLabel.style': 'Style',
  'shoppingChat.modeLabel.shopping': 'Shopping',
  'shoppingChat.cardOpen': 'Open',
  'shoppingChat.cardOpenHint': 'Opens the product page in your browser',
  // Placeholder pattern matches mobile's i18n shim — see lib/i18n.ts.
  'shoppingChat.cardPriceTemplate': '{amount} {currency}',
  'shoppingChat.invalidUrl': 'Invalid product link',
  'chat.mode.SHOPPING': 'Shopping',

  // ─── M24 — Pick Must-Haves (WardrobeGaps follow-up) ────────────────────
  'pickMustHaves.title': 'Pick must-haves',
  'pickMustHaves.eyebrow': 'Shopping list',
  'pickMustHaves.intro':
    'Mark the gaps you want to actually buy and set their priority. Your shortlist is saved to your profile.',
  'pickMustHaves.priority.high': 'High',
  'pickMustHaves.priority.medium': 'Med',
  'pickMustHaves.priority.low': 'Low',
  'pickMustHaves.notesPlaceholder': 'Add a note (size, brand, store…)',
  'pickMustHaves.save': 'Save list',
  'pickMustHaves.saving': 'Saving…',
  'pickMustHaves.saved': 'Shopping list saved',
  'pickMustHaves.empty.title': 'Nothing to pick yet',
  'pickMustHaves.empty.body':
    'Run a wardrobe gap analysis first to see which key pieces are worth adding.',
  'pickMustHaves.empty.cta': 'Open Wardrobe Gaps',
  'pickMustHaves.savedCountTemplate': '{count} items saved',
  'wardrobeGaps.pickMustHavesCta': 'Pick must-haves',
  'profile.shoppingList': 'Shopping list',
  'profile.shoppingListEmpty': 'No saved must-haves yet',
};
