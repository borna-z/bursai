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
  // Q-D1 — surfaces inline on the assistant bubble when a stream fails so
  // the user always sees that their turn was acknowledged. Without it the
  // bubble was filtered out and the banner suppressed (empty err.message)
  // produced pure silence — see Q-D1 spec.
  'chat.error.generic': "Something went wrong. Please try again.",
  'chat.error.inlineFallback': "Couldn't generate a reply. Tap Retry above to try again.",
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

  // ─── Home — Weather strip + Occasion picker + Recent outfits (M35) ────
  'home.weather.eyebrow': 'Today',
  'home.weather.tomorrowTemplate': 'Tomorrow {high}° / {low}° · {condition}',
  'home.occasion.eyebrow': "What's the day for?",
  'home.occasion.casual': 'Casual',
  'home.occasion.work': 'Work',
  'home.occasion.party': 'Party',
  'home.occasion.workout': 'Workout',
  'home.occasion.dinner': 'Dinner',
  'home.recent.eyebrow': 'Recent outfits',
  'home.recent.empty': 'Saved looks land here.',
  'home.recent.savedFallback': 'Saved',
  'weather.condition.clear': 'Clear',
  'weather.condition.cloudy': 'Cloudy',
  'weather.condition.fog': 'Fog',
  'weather.condition.drizzle': 'Drizzle',
  'weather.condition.rain': 'Rain',
  'weather.condition.snow': 'Snow',
  'weather.condition.rain_showers': 'Rain showers',
  'weather.condition.snow_showers': 'Snow showers',
  'weather.condition.thunder': 'Thunder',
  'weather.condition.unknown': '—',

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
  // M17 Codex P2.6 — fallback button label while the composition helpers are
  // mid-request. Distinct from the persistent action labels so the user
  // sees the call is in flight.
  'outfitDetail.helperLoading': 'Loading…',
  // M17 Codex P1.8 — refresh affordance inside the collapsible composition
  // sections. Aria/visual label for the small icon button.
  'outfitDetail.refreshAction': 'Refresh',

  // ─── M37 — outfit detail slot composition ──────────────────────────────
  // Slot eyebrows + the per-slot Swap / Anchor / Remove actions surfaced on
  // each OutfitSlotRow. The bottom-sheet picker shown when the user taps
  // Swap also reads from this section.
  'outfitDetail.slot.top': 'Top',
  'outfitDetail.slot.layer': 'Layer',
  'outfitDetail.slot.bottom': 'Bottom',
  'outfitDetail.slot.dress': 'Dress',
  'outfitDetail.slot.shoes': 'Shoes',
  'outfitDetail.slot.outerwear': 'Outerwear',
  'outfitDetail.slot.accessory': 'Accessory',
  'outfitDetail.slotAction.swap': 'Swap',
  'outfitDetail.slotAction.makeAnchor': 'Anchor',
  'outfitDetail.slotAction.anchored': 'Anchored',
  'outfitDetail.slotAction.remove': 'Remove',
  'outfitDetail.removedPiece': 'Removed piece',
  'outfitDetail.swap.title': 'Swap {slot}',
  'outfitDetail.swap.empty':
    "Nothing else in your wardrobe fits this slot.",
  'outfitDetail.swap.loading': 'Looking through your wardrobe…',
  'outfitDetail.swap.cancel': 'Cancel',
  'outfitDetail.remove.title': 'Remove piece',
  'outfitDetail.remove.body':
    'Remove {title} from this outfit? You can swap it back in later.',
  'outfitDetail.remove.confirm': 'Remove',
  'outfitDetail.remove.cancel': 'Cancel',
  'outfitDetail.anchor.cleared': 'Anchor cleared',

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
  // Singular/plural variants — the screen picks the variant via a small
  // helper so the count grammar is correct in English. Other locales
  // can deviate as they land. Bare `savedCountTemplate` kept for
  // back-compat with any older callers.
  'pickMustHaves.savedCountTemplate.one': '1 item saved',
  'pickMustHaves.savedCountTemplate.other': '{count} items saved',
  'pickMustHaves.selectedCountTemplate.one': '1 selected',
  'pickMustHaves.selectedCountTemplate.other': '{count} selected',
  'pickMustHaves.loadError': 'Couldn’t load your saved list. Pull to retry.',
  'pickMustHaves.remove': 'Remove',
  'pickMustHaves.removeAriaLabel': 'Remove from shopping list',
  'wardrobeGaps.pickMustHavesCta': 'Pick must-haves',
  'profile.shoppingList': 'Shopping list',
  'profile.shoppingListEmpty': 'No saved must-haves yet',

  // ─── M25 — Onboarding StyleQuizV4 (full 12-question capture) ────────────
  // Copy mirrors the web `StyleQuizV4.tsx` user-facing strings verbatim so
  // the brand voice is consistent across platforms. Append-only; other 9
  // locales fall back to en until M33 ports the dictionary.
  'onboarding.quizV4.title': 'Tell us how you dress.',
  'onboarding.quizV4.intro':
    'Twelve quick answers help BURS tune outfits, planning, and wardrobe guidance around your real life.',
  'onboarding.quizV4.continue': 'Continue',
  'onboarding.quizV4.skip': 'Skip',
  'onboarding.quizV4.back': 'Back',
  'onboarding.quizV4.progressTemplate': '{current} of {total}',
  // Inline hint shown under the disabled Continue button on required
  // questions (Q1 identity, Q4 archetypes, Q11 goal). Without it, sighted
  // users with no AT just see a non-responsive button (M25 Codex P2).
  'onboarding.quizV4.requiredHint': 'Answer to continue',

  // Q1 — Identity & body
  'onboarding.quizV4.q.identity.prompt': 'A bit about you.',
  'onboarding.quizV4.q.identity.help':
    'Helps BURS suggest cuts and fits that flatter you.',
  'onboarding.quizV4.q.identity.gender': 'How do you express your style?',
  'onboarding.quizV4.q.identity.height': 'Height',
  'onboarding.quizV4.q.identity.heightDecrease': 'Decrease height',
  'onboarding.quizV4.q.identity.heightIncrease': 'Increase height',
  'onboarding.quizV4.q.identity.cm': 'cm',
  'onboarding.quizV4.q.identity.build': 'Build',
  'onboarding.quizV4.q.identity.ageRange': 'Age range',
  'onboarding.quizV4.choice.gender.feminine': 'Feminine',
  'onboarding.quizV4.choice.gender.masculine': 'Masculine',
  'onboarding.quizV4.choice.gender.neutral': 'Neutral',
  'onboarding.quizV4.choice.gender.prefer_not': 'Prefer not to say',
  'onboarding.quizV4.choice.build.slim': 'Slim',
  'onboarding.quizV4.choice.build.athletic': 'Athletic',
  'onboarding.quizV4.choice.build.curvy': 'Curvy',
  'onboarding.quizV4.choice.build.fuller': 'Fuller',
  'onboarding.quizV4.choice.build.prefer_not': 'Prefer not to say',
  'onboarding.quizV4.choice.ageRange.18-24': '18–24',
  'onboarding.quizV4.choice.ageRange.25-34': '25–34',
  'onboarding.quizV4.choice.ageRange.35-44': '35–44',
  'onboarding.quizV4.choice.ageRange.45-54': '45–54',
  'onboarding.quizV4.choice.ageRange.55-64': '55–64',
  'onboarding.quizV4.choice.ageRange.65+': '65+',

  // Q2 — Lifestyle mix
  'onboarding.quizV4.q.lifestyle.prompt': 'How is your week split?',
  'onboarding.quizV4.q.lifestyle.help':
    'Drag each slider to roughly reflect your time. Totals do not need to hit 100.',
  'onboarding.quizV4.q.lifestyle.total': 'Total: {total}%',
  'onboarding.quizV4.choice.lifestyle.work': 'Work',
  'onboarding.quizV4.choice.lifestyle.social': 'Social',
  'onboarding.quizV4.choice.lifestyle.casual': 'Casual',
  'onboarding.quizV4.choice.lifestyle.sport': 'Sport',
  'onboarding.quizV4.choice.lifestyle.evening': 'Evening',

  // Q3 — Climate & location
  'onboarding.quizV4.q.climate.prompt': 'Where do you dress?',
  'onboarding.quizV4.q.climate.help':
    'So weather and seasons are baked into recommendations from day one.',
  'onboarding.quizV4.q.climate.homeCity': 'Home city (optional)',
  'onboarding.quizV4.q.climate.homeCityPlaceholder': 'Stockholm',
  'onboarding.quizV4.q.climate.climate': 'Climate',
  'onboarding.quizV4.q.climate.secondaryCity': 'Travel often? (optional)',
  'onboarding.quizV4.q.climate.secondaryCityPlaceholder': 'London',
  'onboarding.quizV4.choice.climate.nordic': 'Nordic',
  'onboarding.quizV4.choice.climate.temperate': 'Temperate',
  'onboarding.quizV4.choice.climate.mediterranean': 'Mediterranean',
  'onboarding.quizV4.choice.climate.tropical': 'Tropical',
  'onboarding.quizV4.choice.climate.desert': 'Desert',
  'onboarding.quizV4.choice.climate.varies': 'Varies',

  // Q4 — Archetypes + style icons
  'onboarding.quizV4.q.archetypes.prompt': 'Pick your style words.',
  'onboarding.quizV4.q.archetypes.help': 'Choose 3–5 that feel true to you.',
  'onboarding.quizV4.q.archetypes.range': 'Pick {min}–{max}',
  'onboarding.quizV4.q.archetypes.selected': '{count} selected',
  'onboarding.quizV4.q.archetypes.icons': 'Style icons (optional)',
  'onboarding.quizV4.q.archetypes.iconsPlaceholder':
    'e.g. The Row, Phoebe Philo, Kanye',
  'onboarding.quizV4.choice.archetypes.minimal': 'Minimal',
  'onboarding.quizV4.choice.archetypes.classic': 'Classic',
  'onboarding.quizV4.choice.archetypes.street': 'Street',
  'onboarding.quizV4.choice.archetypes.preppy': 'Preppy',
  'onboarding.quizV4.choice.archetypes.bohemian': 'Bohemian',
  'onboarding.quizV4.choice.archetypes.sporty': 'Sporty',
  'onboarding.quizV4.choice.archetypes.edgy': 'Edgy',
  'onboarding.quizV4.choice.archetypes.romantic': 'Romantic',
  'onboarding.quizV4.choice.archetypes.scandi': 'Scandi',
  'onboarding.quizV4.choice.archetypes.avantgarde': 'Avant-garde',
  'onboarding.quizV4.choice.archetypes.workwear': 'Workwear',
  'onboarding.quizV4.choice.archetypes.soft': 'Soft',

  // Q5 — Color DNA
  'onboarding.quizV4.q.colors.prompt': 'Your color story.',
  'onboarding.quizV4.q.colors.help': 'Up to 3 favorites, up to 3 to avoid.',
  'onboarding.quizV4.q.colors.favorites': 'Love wearing',
  'onboarding.quizV4.q.colors.disliked': 'Avoid',
  'onboarding.quizV4.q.colors.palette': 'Palette vibe',
  'onboarding.quizV4.q.colors.pattern': 'Patterns',
  'onboarding.quizV4.choice.color.black': 'Black',
  'onboarding.quizV4.choice.color.white': 'White',
  'onboarding.quizV4.choice.color.grey': 'Grey',
  'onboarding.quizV4.choice.color.navy': 'Navy',
  'onboarding.quizV4.choice.color.blue': 'Blue',
  'onboarding.quizV4.choice.color.beige': 'Beige',
  'onboarding.quizV4.choice.color.camel': 'Camel',
  'onboarding.quizV4.choice.color.brown': 'Brown',
  'onboarding.quizV4.choice.color.olive': 'Olive',
  'onboarding.quizV4.choice.color.green': 'Green',
  'onboarding.quizV4.choice.color.red': 'Red',
  'onboarding.quizV4.choice.color.burgundy': 'Burgundy',
  'onboarding.quizV4.choice.color.pink': 'Pink',
  'onboarding.quizV4.choice.color.purple': 'Purple',
  'onboarding.quizV4.choice.color.orange': 'Orange',
  'onboarding.quizV4.choice.color.teal': 'Teal',
  'onboarding.quizV4.choice.color.cream': 'Cream',
  'onboarding.quizV4.choice.color.denim': 'Denim',
  'onboarding.quizV4.choice.palette.neutrals': 'Neutrals',
  'onboarding.quizV4.choice.palette.bold': 'Bold',
  'onboarding.quizV4.choice.palette.dark': 'Dark',
  'onboarding.quizV4.choice.palette.pastels': 'Pastels',
  'onboarding.quizV4.choice.palette.earth': 'Earth',
  'onboarding.quizV4.choice.palette.mixed': 'Mixed',
  'onboarding.quizV4.choice.pattern.love': 'Love patterns',
  'onboarding.quizV4.choice.pattern.some': 'Some',
  'onboarding.quizV4.choice.pattern.minimal': 'Minimal',
  'onboarding.quizV4.choice.pattern.solids_only': 'Solids only',

  // Q6 — Fit & silhouette
  'onboarding.quizV4.q.fit.prompt': 'Fit & silhouette.',
  'onboarding.quizV4.q.fit.help':
    'How the clothes sit on you when they feel right.',
  'onboarding.quizV4.q.fit.overall': 'Overall fit',
  'onboarding.quizV4.q.fit.topVsBottom': 'Top vs bottom',
  'onboarding.quizV4.q.fit.layering': 'Layering',
  'onboarding.quizV4.q.fit.bodyFocus': 'Show off',
  'onboarding.quizV4.choice.fitOverall.fitted': 'Fitted',
  'onboarding.quizV4.choice.fitOverall.regular': 'Regular',
  'onboarding.quizV4.choice.fitOverall.relaxed': 'Relaxed',
  'onboarding.quizV4.choice.fitOverall.oversized': 'Oversized',
  'onboarding.quizV4.choice.fitOverall.mixed': 'Mixed',
  'onboarding.quizV4.choice.fitTopVsBottom.same': 'Same all over',
  'onboarding.quizV4.choice.fitTopVsBottom.fitted_top_loose_bottom':
    'Fitted top, loose bottom',
  'onboarding.quizV4.choice.fitTopVsBottom.loose_top_fitted_bottom':
    'Loose top, fitted bottom',
  'onboarding.quizV4.choice.fitTopVsBottom.mixed': 'Mixed',
  'onboarding.quizV4.choice.layering.minimal': 'Minimal',
  'onboarding.quizV4.choice.layering.some': 'Some',
  'onboarding.quizV4.choice.layering.love': 'Love it',
  'onboarding.quizV4.choice.bodyFocus.shoulders': 'Shoulders',
  'onboarding.quizV4.choice.bodyFocus.waist': 'Waist',
  'onboarding.quizV4.choice.bodyFocus.legs': 'Legs',
  'onboarding.quizV4.choice.bodyFocus.none': 'None',

  // Q7 — Formality range
  'onboarding.quizV4.q.formality.prompt': 'How formal can you go?',
  'onboarding.quizV4.q.formality.help':
    'Set your usual floor and your dressed-up ceiling.',
  'onboarding.quizV4.q.formality.floor': 'Casual floor',
  'onboarding.quizV4.q.formality.ceiling': 'Formal ceiling',

  // Q8 — Fabric & feel
  'onboarding.quizV4.q.fabric.prompt': 'Fabric & feel.',
  'onboarding.quizV4.q.fabric.help': 'Pick what you reach for and what you avoid.',
  'onboarding.quizV4.q.fabric.preferred': 'Love wearing (up to 3)',
  'onboarding.quizV4.q.fabric.sensitivities': 'Sensitivities',
  'onboarding.quizV4.q.fabric.care': 'Care preference',
  'onboarding.quizV4.choice.fabric.cotton': 'Cotton',
  'onboarding.quizV4.choice.fabric.wool': 'Wool',
  'onboarding.quizV4.choice.fabric.linen': 'Linen',
  'onboarding.quizV4.choice.fabric.silk': 'Silk',
  'onboarding.quizV4.choice.fabric.cashmere': 'Cashmere',
  'onboarding.quizV4.choice.fabric.denim': 'Denim',
  'onboarding.quizV4.choice.fabric.leather': 'Leather',
  'onboarding.quizV4.choice.fabric.synthetic': 'Synthetic',
  'onboarding.quizV4.choice.fabric.tencel': 'Tencel',
  'onboarding.quizV4.choice.fabric.jersey': 'Jersey',
  'onboarding.quizV4.choice.fabricSensitivity.wool_itchy': 'Wool feels itchy',
  'onboarding.quizV4.choice.fabricSensitivity.synthetic_avoid': 'Avoid synthetics',
  'onboarding.quizV4.choice.fabricSensitivity.linen_wrinkles':
    'Linen wrinkles bother me',
  'onboarding.quizV4.choice.fabricSensitivity.leather_avoid': 'Avoid leather',
  'onboarding.quizV4.choice.fabricSensitivity.silk_fragile': 'Silk too fragile',
  'onboarding.quizV4.choice.fabricSensitivity.none': 'None',
  'onboarding.quizV4.choice.care.easy_care': 'Easy care',
  'onboarding.quizV4.choice.care.mixed': 'Mixed',
  'onboarding.quizV4.choice.care.high_maintenance_ok': 'High-maintenance OK',

  // Q9 — Occasions
  'onboarding.quizV4.q.occasions.prompt': 'When do you need outfits most?',
  'onboarding.quizV4.q.occasions.help': 'Pick all that apply.',
  'onboarding.quizV4.choice.occasion.work': 'Work',
  'onboarding.quizV4.choice.occasion.casual': 'Casual',
  'onboarding.quizV4.choice.occasion.date': 'Date',
  'onboarding.quizV4.choice.occasion.party': 'Party',
  'onboarding.quizV4.choice.occasion.travel': 'Travel',
  'onboarding.quizV4.choice.occasion.workout': 'Workout',
  'onboarding.quizV4.choice.occasion.formal_event': 'Formal event',
  'onboarding.quizV4.choice.occasion.weekend': 'Weekend',

  // Q10 — Shopping habits
  'onboarding.quizV4.q.shopping.prompt': 'How do you shop?',
  'onboarding.quizV4.q.shopping.help':
    'A rough sense of cadence, budget, and style helps tune recommendations.',
  'onboarding.quizV4.q.shopping.frequency': 'How often',
  'onboarding.quizV4.q.shopping.budget': 'Budget',
  'onboarding.quizV4.q.shopping.style': 'Shopping style',
  'onboarding.quizV4.choice.shoppingFrequency.rare': 'Rarely',
  'onboarding.quizV4.choice.shoppingFrequency.seasonal': 'Seasonally',
  'onboarding.quizV4.choice.shoppingFrequency.monthly': 'Monthly',
  'onboarding.quizV4.choice.shoppingFrequency.frequent': 'Frequently',
  'onboarding.quizV4.choice.budget.budget': 'Budget',
  'onboarding.quizV4.choice.budget.mid': 'Mid',
  'onboarding.quizV4.choice.budget.premium': 'Premium',
  'onboarding.quizV4.choice.budget.luxury': 'Luxury',
  'onboarding.quizV4.choice.budget.mixed': 'Mixed',
  'onboarding.quizV4.choice.shoppingStyle.planned': 'Planned',
  'onboarding.quizV4.choice.shoppingStyle.impulse': 'Impulse',
  'onboarding.quizV4.choice.shoppingStyle.mixed': 'Mixed',

  // Q11 — Primary goal
  'onboarding.quizV4.q.goal.prompt': 'What should BURS do for you?',
  'onboarding.quizV4.q.goal.help': 'Pick the one that matters most right now.',
  'onboarding.quizV4.choice.goal.reduce_decisions.label': 'Reduce decisions',
  'onboarding.quizV4.choice.goal.reduce_decisions.caption':
    'A clear pick every morning, no decision fatigue.',
  'onboarding.quizV4.choice.goal.discover_style.label': 'Discover my style',
  'onboarding.quizV4.choice.goal.discover_style.caption':
    'Pairings and looks I would not have tried alone.',
  'onboarding.quizV4.choice.goal.curate_capsule.label': 'Curate a capsule',
  'onboarding.quizV4.choice.goal.curate_capsule.caption':
    'Fewer pieces, more outfits, on purpose.',
  'onboarding.quizV4.choice.goal.special_events.label': 'Plan special events',
  'onboarding.quizV4.choice.goal.special_events.caption':
    'Nail the brief for weddings, dates, parties.',
  'onboarding.quizV4.choice.goal.professional_polish.label':
    'Professional polish',
  'onboarding.quizV4.choice.goal.professional_polish.caption':
    'Look the part at work, every meeting.',
  'onboarding.quizV4.choice.goal.sustainability.label': 'Shop more sustainably',
  'onboarding.quizV4.choice.goal.sustainability.caption':
    'Wear what I own; fill only the real gaps.',
  'onboarding.quizV4.choice.goal.fun_experimenting.label': 'Have fun experimenting',
  'onboarding.quizV4.choice.goal.fun_experimenting.caption':
    'Try new looks; treat dressing as play.',

  // Q12 — Cultural / accessibility
  'onboarding.quizV4.q.cultural.prompt': 'Anything else BURS should know?',
  'onboarding.quizV4.q.cultural.help':
    'Cultural, religious, or accessibility needs we should respect. Optional.',
  'onboarding.quizV4.q.cultural.placeholder':
    'e.g. always cover shoulders, prefer modest cuts, no high heels.',

  // Completion screen (currently rendered by the Achievement step that
  // follows; reserved here for future inline confirmation if the screen
  // ever needs to surface a "Done" state before advancing).
  'onboarding.quizV4.complete.title': 'Your style profile is set.',
  'onboarding.quizV4.complete.body':
    'BURS now tunes outfits, planning, and shopping around your real life.',
  'onboarding.quizV4.complete.cta': 'Done',

  // ─── M27 — PhotoTutorialStep (onboarding) ──────────────────────────────
  // Single-screen "how to scan a garment" tutorial inserted between
  // StyleQuizV4Step and StudioSelectionStep. Other 9 locales fall back
  // to en until M33 ports the dictionary.
  'onboarding.photoTutorial.eyebrow': 'How to scan',
  'onboarding.photoTutorial.title': 'Take a great garment photo',
  'onboarding.photoTutorial.intro':
    'A minute here saves hours later. A few quick rules and we’re off.',
  'onboarding.photoTutorial.good.title': 'Flat, well-lit, full garment',
  'onboarding.photoTutorial.good.bullets.0':
    'Bright, even light — daylight near a window works best.',
  'onboarding.photoTutorial.good.bullets.1':
    'Plain background — lay the piece flat on a bed, floor, or wall.',
  'onboarding.photoTutorial.good.bullets.2':
    'Whole garment in frame — show the full piece edge to edge.',
  'onboarding.photoTutorial.good.bullets.3':
    'No people — keep hands, mirrors, and faces out of the shot.',
  'onboarding.photoTutorial.bad.title': 'Dim, cluttered, or cropped',
  'onboarding.photoTutorial.bad.bullets.0':
    'Avoid harsh shadows, moody side-light, or low-light corners.',
  'onboarding.photoTutorial.bad.bullets.1':
    'Skip busy patterned backgrounds — they confuse the AI.',
  'onboarding.photoTutorial.bad.bullets.2':
    'Don’t crop sleeves, hems, or hardware out of frame.',
  'onboarding.photoTutorial.bad.bullets.3':
    'Don’t photograph the garment on a person or mannequin.',
  'onboarding.photoTutorial.continue': 'Continue',
  'onboarding.photoTutorial.skip': 'Skip',

  // ─── M27 — Coach tour (post-onboarding overlay sequence) ───────────────
  // 4-step Home → Wardrobe → Add → Outfits walk-through. State persists
  // to `profiles.preferences.coach_tour_completed_at` (ISO timestamp).
  'coachTour.step.home':
    "Today's outfit goes here — your daily plan starts on this card.",
  'coachTour.step.wardrobe':
    'Your garments live here — every piece you scan lands in this grid.',
  'coachTour.step.add':
    'Tap (+) to add a piece — the gold button is your fastest path in.',
  'coachTour.step.outfits': 'Saved looks live here.',
  'coachTour.next': 'Next',
  'coachTour.skip': 'Skip',
  'coachTour.done': 'Done',
  'coachTour.progressTemplate': '{current} of {total}',
  // M27 R1 — Skip-confirm dialog (post-review fix). Skip is a destructive
  // affordance (the tour can't be replayed today, see findings-log entry
  // for "Settings → Replay tour"), so an Alert.alert prompt prevents an
  // accidental tap on step 1 from killing the tour forever.
  'coachTour.skipConfirm.title': 'Skip the tour?',
  'coachTour.skipConfirm.body':
    "You won't see these tips again. You can always poke around — the app will guide you when it can.",
  'coachTour.skipConfirm.cancel': 'Keep going',
  'coachTour.skipConfirm.confirm': 'Skip',

  // ─── M28 — Travel capsule end-to-end ───────────────────────────────────
  // The wizard threads through TravelCapsule → TravelMustHaves →
  // TravelPackingList. Generation hits the `travel_capsule` edge function
  // (~30s round-trip on a fresh wardrobe) and persists via
  // `useGenerateTravelCapsule` since the function doesn't INSERT itself.
  'travelCapsule.savedHeading': 'Saved trips',
  'travelCapsule.savedEmpty': 'No saved capsules yet',
  'travelCapsule.savedEmptyBody':
    'Plan your first trip below — your saved capsules will live here.',
  'travelCapsule.savedTripDeletedTitle': 'Removed',
  'travelCapsule.savedTripDeleteFailed': "Couldn't delete that trip. Try again.",
  'travelCapsule.delete.confirmTitle': 'Delete this trip?',
  // Placeholder pattern matches mobile's i18n shim — see lib/i18n.ts.
  'travelCapsule.delete.confirmBody':
    'Your capsule for {destination} will be removed. This cannot be undone.',
  'travelCapsule.delete.confirmCancel': 'Keep',
  'travelCapsule.delete.confirmConfirm': 'Delete',
  'travelCapsule.delete.aria': 'Delete saved trip',
  'travelCapsule.openSavedHint': 'Opens this saved capsule',
  'travelCapsule.savedTripItemsTemplate': '{items} pieces · {outfits} looks',
  'travelCapsule.generating': 'Building your capsule…',
  'travelCapsule.generatingBody':
    "BURS is choosing pieces that travel well — this can take up to 30 seconds.",
  'travelCapsule.generateFailed.title': "Couldn't build a capsule",
  'travelCapsule.generateFailed.body':
    'Something went wrong on our side. Try again in a moment.',
  'travelCapsule.subscriptionRequired.title': 'Premium feature',
  'travelCapsule.subscriptionRequired.body':
    'Travel capsule is part of BURS Premium. Upgrade to keep packing smart.',
  'travelCapsule.notEnoughGarmentsTitle': 'Not enough wardrobe yet',
  'travelCapsule.notEnoughGarmentsBody':
    'Add at least 5 garments to your wardrobe before building a capsule.',

  // Step 2 — must-haves edit support. The user can flag a piece as
  // "have", "buy" (gap they intend to purchase), or "unsure" — the
  // tri-state mirrors web's PR #735 / Pick Must-Haves vocabulary.
  'travelMustHaves.heading': 'Your must-haves',
  'travelMustHaves.intro':
    'Mark each piece — bringing it, replacing it, or still deciding. Your call.',
  'travelMustHaves.status.have': 'I have this',
  'travelMustHaves.status.buy': "I'll buy",
  'travelMustHaves.status.unsure': 'Not sure',
  'travelMustHaves.status.aria': 'Cycle through have / buy / unsure',
  'travelMustHaves.continueCta': 'Continue · Packing list',
  'travelMustHaves.empty.title': 'No must-haves yet',
  'travelMustHaves.empty.body':
    'Build a capsule first to see the pieces BURS chose for you.',
  'travelMustHaves.saveFailed': "Couldn't save your changes. Try again.",
  // Audit follow-up (2026-05-07): distinct copy for the save-conflict path
  // so the user understands a fresher write landed first (the screen
  // refetches in the background; tap dismiss and the latest state shows).
  'travelMustHaves.saveConflictTitle': 'Updated elsewhere',
  'travelMustHaves.saveConflictBody':
    "We pulled in a fresher version of this trip. Your last change wasn't saved — review the latest and try again if needed.",

  // Step 3 — packing list. Per-item checkboxes persist into
  // `result.packed_state` JSONB on the capsule row, debounced 300ms so
  // the user can rip through a list without 25 server writes.
  'travelPackingList.eyebrowTemplate': '{destination} · {duration}',
  'travelPackingList.empty.title': 'Empty packing list',
  'travelPackingList.empty.body':
    'No items here yet — try regenerating the capsule.',
  'travelPackingList.allPacked': 'All packed · ready to fly',
  // Surfaced when a packed-state write fails. Local checkbox state
  // reverts to the last-known-good snapshot so the UI doesn't lie about
  // a save that didn't land.
  'travelPackingList.saveFailedTitle': "Couldn't save",
  'travelPackingList.saveFailedBody':
    "We couldn't save your packing changes. Pull to refresh and try again.",
  // Specific copy for the optimistic-concurrency conflict — the row
  // moved under us (cross-device or rapid same-device writes). The
  // mutation refetches automatically; the user just needs to retry.
  'travelPackingList.saveConflictTitle': 'Save conflict',
  'travelPackingList.saveConflictBody':
    'Your packing list was updated elsewhere. Please retry.',
  // Singular handled inline by the screen; the template covers 0 / 2+.
  'travelPackingList.itemsLeftTemplate': '{count} pieces left',
  'travelPackingList.itemsLeftOne': '1 piece left',
  'travelPackingList.toggleAria': 'Mark as packed',
  'travelPackingList.shareCta': 'Share packing list',
  'travelPackingList.shareSoon': 'Sharing coming soon.',
  'travelPackingList.daysTemplate.zero': 'Day trip',
  'travelPackingList.daysTemplate.one': '1 day',
  'travelPackingList.daysTemplate.other': '{count} days',

  // ─── M29 — Style DNA + wardrobe stats ───────────────────────────────────
  // ProfileScreen + SettingsStyleScreen surfaces wired to the
  // user_style_summaries row with a V4-quiz fallback. Append-only.
  'profile.styleDNA.archetype': 'Archetype',
  'profile.styleDNA.formality': 'Formality',
  'profile.styleDNA.vibes': 'Vibes',
  'profile.styleDNA.empty':
    'Your Style DNA builds as you wear and rate outfits.',
  // StatBlock labels (uppercase noun) + accessibility templates that
  // interpolate the live count so screen readers announce the full
  // "12 garments" sentence rather than a bare "12 / GARMENTS" split.
  'profile.stats.garmentsTemplate': '{count} garments',
  'profile.stats.outfitsTemplate': '{count} outfits',
  'profile.stats.wearLogsTemplate': '{count} wears',
  'profile.stats.garments': 'Garments',
  'profile.stats.outfits': 'Outfits',
  'profile.stats.wears': 'Wears',
  'profile.refresh': 'Pull to refresh',
  'settings.wardrobeBadgeTemplate': '{count} items',
  'settingsStyle.dnaPreview.title': 'Your style DNA',
  'settingsStyle.dnaPreview.empty':
    'Take the quiz to build your DNA preview.',

  // ─── M29 review pass — review-finding follow-ups ───────────────────────
  // Review pass: real swatches + count caption + i18n for the "coming
  // soon" alert bodies. Append-only. The full editor lands in M38.
  'settingsStyle.favoritesCountTemplate.one': '1 favorite',
  'settingsStyle.favoritesCountTemplate': '{count} favorites',
  'settingsStyle.editStyleWords.title': 'Coming soon',
  'settingsStyle.editStyleWords.body': 'Style word editing coming soon.',
  'settingsStyle.editColorPreferences.title': 'Coming soon',
  'settingsStyle.editColorPreferences.body':
    'Color preference editing coming soon.',
  'settings.styleProfileEmpty': 'Build your DNA in the style profile',

  // ─── M28(b) — Travel capsule garment picker step ────────────────────────
  // Append-only. The wizard now opens with a "Pick must-haves" screen
  // before destination/dates so the user can curate which wardrobe pieces
  // anchor the trip. Picker selections become primary must-haves; the
  // AI-emitted coverage_gaps render as a secondary "We also noticed gaps"
  // section in TravelMustHaves.
  'travelCapsule.pickerStep.eyebrow': 'Step 1 of 3',
  'travelCapsule.pickerStep.title': 'Pick the pieces you need',
  'travelCapsule.pickerStep.intro':
    'Tap up to 8 pieces you definitely want on this trip. Skip if you want BURS to choose entirely.',
  'travelCapsule.pickerStep.continueWithoutPicks': 'Skip · let BURS choose',
  'travelCapsule.pickerStep.continueWithPicks': 'Continue with these',
  'travelGarmentPicker.searchPlaceholder': 'Search your wardrobe',
  'travelGarmentPicker.filter.all': 'All',
  'travelGarmentPicker.filter.tops': 'Tops',
  'travelGarmentPicker.filter.bottoms': 'Bottoms',
  'travelGarmentPicker.filter.outerwear': 'Outerwear',
  'travelGarmentPicker.filter.shoes': 'Shoes',
  'travelGarmentPicker.filter.accessories': 'Accessories',
  // Pluralisation handled by the picker — `.one` for exactly 1 selected,
  // `.other` for 0 / 2+. Both interpolate the {max} cap; `.other` adds {count}.
  'travelGarmentPicker.selectedTemplate.one': '1 / {max} selected',
  'travelGarmentPicker.selectedTemplate.other': '{count} / {max} selected',
  'travelGarmentPicker.empty.title': 'No garments yet',
  'travelGarmentPicker.empty.body':
    'Add some pieces to your wardrobe before building a capsule.',
  'travelGarmentPicker.empty.cta': 'Add a piece',

  // Section headers in TravelMustHaves — distinguishes user-curated
  // primary picks from AI-suggested coverage gaps.
  'travelMustHaves.section.picks': 'Your picks',
  'travelMustHaves.section.gaps': 'We also noticed gaps for this trip',

  // ─── M30 — Settings · Notifications ──────────────────────────────────────
  // Three opt-in toggles surfaced in SettingsNotificationsScreen + the
  // permissions-denied banner that links into iOS Settings.
  'settingsNotifications.permissionsRequest':
    "What you'd like BURS to ping you about.",
  'settingsNotifications.daily.label': 'Daily outfit suggestion',
  'settingsNotifications.daily.body': 'Your morning look, ready when you wake up.',
  'settingsNotifications.newOutfit.label': 'New outfit ready',
  'settingsNotifications.newOutfit.body':
    "We'll let you know when a fresh combination lands.",
  'settingsNotifications.reminders.label': 'Reminders',
  'settingsNotifications.reminders.body':
    'Laundry nudges, planned-outfit prompts, and gentle wardrobe check-ins.',
  'settingsNotifications.permissionsDenied.title': 'Notifications are off',
  'settingsNotifications.permissionsDenied.body':
    'BURS needs notification permission to send you outfit reminders. Enable it in iOS Settings to start receiving pings.',
  'settingsNotifications.permissionsDenied.openSettings': 'Open Settings',

  // ─── M31 — Paywall (RevenueCat) ─────────────────────────────────────────
  // Append-only additions to the existing paywall.* namespace. The pre-M31
  // keys (paywall.title / paywall.feature.*.* / paywall.plan.* /
  // paywall.price.* / paywall.cta / paywall.trial.* / paywall.terms /
  // paywall.privacy etc.) are reused directly by PaywallScreen and not
  // duplicated here. These keys cover only the new surfaces introduced by
  // PR A: subtitle / bullet shorthand / per-plan IAP labels / processing +
  // success / pending / error states / dedicated restore-purchases label /
  // legal-link external-target labels.
  'paywall.subtitle': 'Unlimited outfits, AI styling, and ghost-mannequin renders.',
  'paywall.bullet.1': 'Unlimited outfit generation',
  'paywall.bullet.2': 'AI style chat in context',
  'paywall.bullet.3': 'Ghost mannequin studio rendering',
  'paywall.bullet.4': 'Travel capsule + wardrobe gaps',
  'paywall.monthly.title': 'Monthly',
  'paywall.monthly.priceLabel': '119 SEK / month',
  'paywall.monthly.cta': 'Start monthly',
  'paywall.yearly.title': 'Yearly',
  'paywall.yearly.priceLabel': '899 SEK / year',
  'paywall.yearly.cta': 'Start yearly',
  'paywall.yearly.savingsBadge': 'Save 35%',
  'paywall.processing': 'Processing…',
  'paywall.activated': 'Subscription active',
  'paywall.activating':
    "Activating your subscription… you'll see it within a minute.",
  'paywall.restorePurchases': 'Restore Purchases',
  'paywall.restored': 'Purchases restored',
  'paywall.error.generic':
    "Something went wrong. We couldn't complete the purchase — please try again.",
  // Cancellation is a silent-dismiss UX. The key exists so engineers
  // searching the locale file see the intentional silence; the screen
  // never renders this string.
  'paywall.error.cancelled': '',
  'paywall.termsLink': 'https://burs.me/terms',
  'paywall.privacyLink': 'https://burs.me/privacy',

  // ─── M31 PR A review — Apple 3.1.2 auto-renewal disclosure ──────────────
  // Required on-screen, BEFORE the purchase CTA, per App Store Review
  // Guideline 3.1.2 (Auto-Renewing Subscriptions). Verbatim Apple-compliant
  // copy — do not paraphrase without re-reading the guideline.
  'paywall.disclosure.autoRenew':
    'Auto-renews unless cancelled at least 24 hours before the end of the current period.',
  'paywall.disclosure.manage':
    'Manage your subscription in your Apple ID settings.',
  'paywall.disclosure.charge':
    'Payment will be charged to your Apple ID account at confirmation of purchase.',

  // CTA fallback copy when the RevenueCat offering ships WITHOUT an
  // introductory free-trial offer. Existing `paywall.cta` keeps the trial
  // language for the trial path.
  'paywall.subscribeCta': 'Subscribe',

  // Restore Purchases — empty-result alert (formerly hidden behind the
  // generic restored toast which lied when entitlements were empty).
  'paywall.restoreNoPurchases.title': 'No purchases to restore',
  'paywall.restoreNoPurchases.body':
    "We didn't find any active subscriptions on this Apple ID.",

  // Alert title/body splits — Alert.alert renders the title as a heading
  // line; using long body strings as titles produced cramped, hard-to-read
  // dialogs. The body strings carry the user-actionable hint (including
  // the webhook-never-fires recovery path for `activating`).
  'paywall.activated.title': 'Subscription active',
  'paywall.activated.body': 'Welcome to BURS Premium.',
  'paywall.activating.title': 'Activating your subscription',
  'paywall.activating.body':
    "This usually takes a few seconds. If it doesn't appear within a minute, tap Restore Purchases.",
  'paywall.errorGeneric.title': "Couldn't complete purchase",
  'paywall.errorGeneric.body': 'Try again or restore previous purchases.',

  // ─── Theme 3 (M33) — Settings hub bring-up ────────────────────────────
  'common.cancel': 'Cancel',
  'common.back': 'Back',
  'common.discard': 'Discard',
  'common.empty': '—',
  'settings.header.eyebrow': 'Account',
  'settings.header.title': 'Settings',
  'settings.profile.fallbackName': 'Your profile',
  'settings.profile.aria': 'Profile',
  'settings.section.profile': 'Profile',
  'settings.section.style': 'Style',
  'settings.section.app': 'App',
  'settings.section.accountData': 'Account & data',
  'settings.section.legal': 'Legal',
  'settings.row.language': 'Language',
  'settings.languageAlert.title': 'Language',
  'settings.languageAlert.body': 'Change language in your style profile.',
  'settings.row.styleProfile': 'Style profile',
  'settings.row.resetMemory': 'Reset style memory',
  'settings.row.resetMemory.caption': 'Clears learned preferences only',
  'settings.row.appearance': 'Appearance',
  'settings.row.appearance.value': 'System',
  'settings.row.notifications': 'Notifications',
  'settings.row.notifications.caption': 'Daily looks · weather · stylist',
  'settings.row.account': 'Account',
  'settings.row.account.caption': 'Email, password, connected accounts',
  'settings.row.privacy': 'Privacy & data',
  'settings.row.privacy.caption': 'Export, reset memory, delete account',
  'settings.row.privacyPolicy': 'Privacy policy',
  'settings.row.terms': 'Terms of service',
  'settings.row.appVersion': 'App version',
  'settings.signOut.label': 'Sign out',
  'settings.signOut.confirm.title': 'Sign out',
  'settings.signOut.confirm.body': 'Are you sure you want to sign out?',
  'settings.footer': 'BURS · {version}',

  // SettingsAccount (Account screen)
  'settings.account.headerEyebrow': 'Settings',
  'settings.account.headerTitle': 'Account',
  'settings.account.editPhoto': 'Edit photo',
  'settings.account.comingSoon.title': 'Coming soon',
  'settings.account.comingSoon.body': 'Profile photo upload coming soon.',
  'settings.account.section.account': 'Account',
  'settings.account.section.data': 'Data',
  'settings.account.row.fullName': 'Full name',
  'settings.account.row.email': 'Email',
  'settings.account.email.alert.title': 'Email',
  'settings.account.email.alert.body': 'To change the email on your account, contact {email}.',
  'settings.account.email.alert.action': 'Email support',
  'settings.account.email.subject': 'Change account email',
  'settings.account.row.changePassword': 'Change password',
  'settings.account.row.connected': 'Connected accounts',
  'settings.account.fullName.alert.title': 'Full name',
  'settings.account.fullName.alert.body': 'Edit your name in Profile.',
  'settings.account.row.export': 'Export my data',
  'settings.account.row.export.caption': 'Get a copy as a ZIP archive',
  'settings.account.export.alert.title': 'Export',
  'settings.account.export.alert.body': 'Your data export will be emailed to you.',
  'settings.account.row.delete': 'Delete account',
  'settings.account.row.delete.caption': 'Permanently removes all data',

  // SettingsPrivacy
  'settings.privacy.headerEyebrow': 'Settings',
  'settings.privacy.headerTitle': 'Privacy & data',
  'settings.privacy.info.eyebrow': 'Your data',
  'settings.privacy.info.body':
    'BURS keeps your wardrobe and style data private. You can export, reset, or delete it at any time.',
  'settings.privacy.info.cta': 'Read privacy policy',
  'settings.privacy.alert.title': 'Privacy policy',
  'settings.privacy.alert.body': 'Visit burs.me/privacy to read the full policy.',

  // ─── Theme 3 (M33) — AddPiece flow ─────────────────────────────────────
  // Step 1 (staging)
  'addpiece.step1.headerEyebrow': 'New garment',
  'addpiece.step1.headerTitle': 'Add pieces',
  'addpiece.step1.permission.title': 'Permission needed',
  'addpiece.step1.permission.body': 'Grant photo access to import from your gallery.',
  'addpiece.step1.galleryError.title': 'Gallery unavailable',
  'addpiece.step1.galleryError.body': 'Could not open the photo library.',
  'addpiece.step1.hero.eyebrow': 'Recommended · single piece',
  'addpiece.step1.hero.title': 'Live scan',
  'addpiece.step1.hero.body': "Place the garment on a flat surface — we'll auto-crop and tag.",
  'addpiece.step1.sourceEyebrow': 'Or add photos',
  'addpiece.step1.source.camera.label': 'Camera',
  'addpiece.step1.source.camera.sub': 'Shoot now',
  'addpiece.step1.source.gallery.label': 'Gallery',
  'addpiece.step1.source.gallery.sub': 'Pick photos',
  'addpiece.step1.source.visualSearch.label': 'Search by photo',
  'addpiece.step1.source.visualSearch.sub': 'Find similar',
  'addpiece.step1.source.importLink.label': 'Import from link',
  'addpiece.step1.source.importLink.sub': 'Paste a URL',
  'addpiece.step1.counterEyebrow': 'Photos staged',
  'addpiece.step1.removePhoto': 'Remove photo',
  'addpiece.step1.addPhoto': 'Add photo',
  'addpiece.step1.addLabel': 'Add',
  'addpiece.step1.maxCaption': 'Up to {max} photos · Private to your wardrobe',
  'addpiece.step1.readyEyebrow': '{count} ready',
  'addpiece.step1.readyCaption': "We'll tag each one automatically",
  'addpiece.step1.cta.first': 'Analyze first',
  'addpiece.step1.cta.single': 'Analyze piece',

  // Step 2 (analyzing)
  'addpiece.step2.headerEyebrow': 'Step {current} of {total}',
  'addpiece.step2.headerTitle': 'Analyzing',
  'addpiece.step2.close': 'Close',
  'addpiece.step2.skip': 'Skip',
  'addpiece.step2.phase.fabric': 'Reading fabric…',
  'addpiece.step2.phase.colors': 'Detecting colors…',
  'addpiece.step2.phase.category': 'Identifying category…',
  'addpiece.step2.phase.almost': 'Almost there…',
  'addpiece.step2.phase.stillWorking': 'Still working — almost there…',
  'addpiece.step2.progress.batch': 'Photo {current} of {total}',
  'addpiece.step2.progress.single': 'Working on it',
  'addpiece.step2.progress.body': "We'll have your garment ready in a moment.",
  'addpiece.step2.progress.batchNote':
    'Multi-photo batch is coming soon — only the first photo is being analyzed in this version. The rest will need to be re-added.',
  'addpiece.step2.error.title': "Couldn't analyze your photo",
  'addpiece.step2.error.body': 'Try again or pick a different photo.',
  'addpiece.step2.error.noPhoto': 'No photo to analyze',
  'addpiece.step2.error.notSignedIn': 'Not signed in',
  'addpiece.step2.error.couldNotAnalyze': 'Could not analyze photo',
  'addpiece.step2.error.uploadFailed': 'Upload failed',
  // Multi-photo batch (M-batch wave). Active note replaces the older
  // 'batchNote' copy, which warned that only the first photo would be
  // analyzed — the new pipeline analyzes every staged photo.
  'addpiece.step2.batch.activeNote':
    "We'll walk you through each photo. The next ones are getting ready in the background.",
  'addpiece.step2.batch.skip': 'Skip this photo',
  'addpiece.step2.batch.retry': 'Retry',

  // Step 3 (review + save)
  'addpiece.step3.headerEyebrow': 'Step 3 of 3',
  'addpiece.step3.headerTitle': 'Confirm',
  'addpiece.step3.rescan': 'Re-scan',
  'addpiece.step3.rescan.aria': 'Re-scan a different photo',
  'addpiece.step3.detected': 'Detected',
  'addpiece.step3.untitled': 'Untitled',
  'addpiece.step3.confidence.high.aria': 'AI confidence high — auto-detected fields look correct',
  'addpiece.step3.confidence.low.aria': 'AI confidence low — please review the auto-detected fields',
  'addpiece.step3.confidence.high': 'Looks good',
  'addpiece.step3.confidence.low': 'Review carefully',
  'addpiece.step3.titleLabel': 'Title',
  'addpiece.step3.titlePlaceholder': 'Name this piece',
  'addpiece.step3.field.category': 'Category',
  'addpiece.step3.field.subcategory': 'Subcategory',
  'addpiece.step3.field.colorPrimary': 'Primary color',
  'addpiece.step3.field.material': 'Material',
  'addpiece.step3.field.pattern': 'Pattern',
  'addpiece.step3.field.fit': 'Fit',
  // Deprecated 2026-05-07 (Theme 3 1st-pass review) — call sites moved to
  // `common.empty`. Key retained per append-only convention; do not remove.
  'addpiece.step3.fieldEmpty': '—',
  'addpiece.step3.seasonsEyebrow': 'Seasons',
  'addpiece.step3.season.spring': 'Spring',
  'addpiece.step3.season.summer': 'Summer',
  'addpiece.step3.season.autumn': 'Autumn',
  'addpiece.step3.season.winter': 'Winter',
  'addpiece.step3.almostEyebrow': 'Almost there',
  'addpiece.step3.almostBody': "We'll keep refining in the background",
  'addpiece.step3.save': 'Save',
  'addpiece.step3.saving': 'Saving…',
  'addpiece.step3.save.aria': 'Save garment',
  'addpiece.step3.saving.aria': 'Saving garment',
  'addpiece.step3.fallback.body': 'Missing analysis data.',
  'addpiece.step3.fallback.startOver': 'Start over',
  'addpiece.step3.error.generic': 'Could not save. Please try again.',
  'addpiece.step3.error.network': 'No internet connection. Try again when you reconnect.',
  'addpiece.step3.error.duplicate': 'Looks like this piece is already in your wardrobe.',
  'addpiece.step3.error.notSignedIn': 'Please sign in again before saving.',
  'addpiece.step3.error.uploadLost': "The upload didn't finish. Tap Re-scan to try again.",
  'addpiece.step3.saveFailed.title': 'Save failed',
  'addpiece.step3.offline.title': 'Saved offline',
  'addpiece.step3.offline.body': "We'll finish saving this piece as soon as you're back online.",
  'addpiece.step3.discard.title': 'Discard this piece?',
  'addpiece.step3.discard.body': "You'll lose the photo and the AI analysis. You can rescan from Step 1.",

  // Save-choice sheet (GarmentSaveChoiceSheet)
  'addpiece.save.eyebrow': 'How to save',
  'addpiece.save.title': 'Save this garment',
  'addpiece.save.body': 'Choose the version you want to save. Both options save right away.',
  'addpiece.save.studio.label': 'Studio quality',
  'addpiece.save.studio.body': 'Save now and let the studio version finish in the background.',
  'addpiece.save.studio.aria': 'Save with studio quality — render finishes in the background',
  'addpiece.save.original.label': 'Original photo',
  'addpiece.save.original.body': 'Save the photo as it is with no studio processing.',
  'addpiece.save.original.aria': 'Save with the original photo — no studio render',

  // M32 — Restore Purchases (Settings entry + new alert copy).
  'settings.account.section.subscription': 'Subscription',
  'settings.account.row.restorePurchases': 'Restore Purchases',
  'settings.account.row.restorePurchases.caption':
    'Reactivate a previous subscription on this Apple ID.',
  // Success body for the restored alert. Apple 3.1.2: no pricing /
  // renewal copy here.
  'paywall.restored.body': 'Your subscription is active again.',
  // Busy label for the restore CTA — distinct from the purchase CTA's
  // `paywall.processing` so the user sees the verb for the action they
  // triggered.
  'paywall.restoring': 'Restoring…',
  // Restore-specific transient-error keys. `paywall.errorGeneric.body`
  // says "Try again or restore previous purchases" — using it here
  // would loop the user back into the same flow that just failed.
  'paywall.restoreError.title': 'Could not restore purchases',
  'paywall.restoreError.body':
    "We couldn't reach the App Store. Check your connection and try again.",

  // ─── Calendar sync (M36) ──────────────────────────────────────────────
  'settings.calendar.section': 'Calendar',
  'settings.calendar.row.connect': 'Connect Google Calendar',
  'settings.calendar.row.connect.caption':
    "Sharper outfit picks based on what's on your day.",
  'settings.calendar.row.disconnect': 'Disconnect Google Calendar',
  'settings.calendar.row.connected.caption': "We're reading your day to style smarter.",
  'settings.calendar.connected.title': 'Calendar connected',
  'settings.calendar.connected.body': "We'll factor your events into today's pick.",
  'settings.calendar.error.title': "Couldn't connect calendar",
  'settings.calendar.error.body': 'Please try again in a moment.',
  'settings.calendar.disconnect.title': 'Disconnect Google Calendar?',
  'settings.calendar.disconnect.body':
    "We'll stop syncing your events and remove what's already saved.",
  'settings.calendar.disconnect.confirm': 'Disconnect',

  // Home — "Ask the stylist" affordance seed copy. The seed renders as the
  // visible suggestion text on the row before the user has any chat history;
  // pulling it through i18n lets us localize the example for non-English users.
  'home.askStylist.exampleSeed': 'What goes with my linen trousers?',
  'home.askStylist.tapHint': 'Tap to chat — context-aware',

  // ─── Home ───────────────────────────────────────────────────────────────
  'home.todaysLook.eyebrow': "Today's Look",
  'home.todaysLook.view': 'View',
  'home.todaysLook.wornToday': 'Worn today',
  'home.todaysLook.wearThis': 'Wear this',
  'home.todaysLook.restyle': 'Restyle',
  'home.todaysLook.empty.title': 'Nothing planned yet',
  'home.todaysLook.empty.body': 'Generate an outfit from your wardrobe or pick from your saved looks.',
  'home.todaysLook.empty.cta': 'Generate outfit',
  'home.section.stylist': 'Your Stylist',
  'home.section.discover': 'Discover',
  'home.section.thisWeek': 'This week',
  'home.section.askStylist': 'Ask the stylist',
  'home.section.rhythm': 'Your rhythm',
  'home.tile.styleChat.label': 'Style Chat',
  'home.tile.styleChat.sub': 'Ask your AI stylist anything',
  'home.tile.outfits.label': 'Outfits',
  'home.tile.outfits.sub': 'Your saved looks & combos',
  'home.tile.styleMe.label': 'Style Me',
  'home.tile.styleMe.sub': 'Get styled for any occasion',
  'home.tile.moodOutfit.label': 'Mood Outfit',
  'home.tile.moodOutfit.sub': 'Dress how you feel',
  'home.tile.travelCapsule.label': 'Travel Capsule',
  'home.tile.travelCapsule.sub': 'Pack smart for any trip',
  'home.tile.wardrobeGaps.label': 'Wardrobe Gaps',
  'home.tile.wardrobeGaps.sub': "What's missing from your closet",
  'home.tile.settings.label': 'Settings',
  'home.tile.settings.sub': 'Preferences & account',
  'home.thisWeek.calendarLink': 'Calendar →',
  'home.thisWeek.wearToday': 'Wear today',
  'home.thisWeek.add': '+ Add',
  'home.rhythm.insightsLink': 'Insights →',
  'home.rhythm.piecesLabel': 'Pieces in wardrobe',
  'home.rhythm.usedLabel': 'Wardrobe used',

  // ─── EditGarment ────────────────────────────────────────────────────────
  'editGarment.field.title': 'Title',
  'editGarment.field.category': 'Category',
  'editGarment.field.subcategory': 'Subcategory',
  'editGarment.field.primaryColor': 'Primary color',
  'editGarment.field.material': 'Material',
  'editGarment.field.fit': 'Fit',
  'editGarment.field.pattern': 'Pattern',
  'editGarment.field.seasons': 'Seasons',
  'editGarment.field.wearCount': 'Wear count',
  'editGarment.field.price': 'Price',
  'editGarment.field.inLaundry': 'In laundry',

  // ─── Settings - Appearance ──────────────────────────────────────────────
  'settings.appearance.theme.light.label': 'Light',
  'settings.appearance.theme.light.caption': 'Editorial cream surface',
  'settings.appearance.theme.dark.label': 'Dark',
  'settings.appearance.theme.dark.caption': 'Warm charcoal surface',
  'settings.appearance.theme.system.label': 'System',
  'settings.appearance.theme.system.caption': 'Follows your device',

  // ─── Wardrobe ───────────────────────────────────────────────────────────
  'wardrobe.empty.title': 'Your wardrobe is empty',
  'wardrobe.empty.body': 'Add your first piece to get started.',
  'wardrobe.empty.cta': 'Add piece',
  'wardrobe.filtered.empty.title': 'No matches for these filters',
  'wardrobe.filtered.empty.body': 'Try a different combination, or clear filters to see your full wardrobe.',
  'wardrobe.filtered.clear': 'Clear filters',
  'wardrobe.allLaundry.title': 'Everything is in laundry',
  'wardrobe.allLaundry.body': "All {count} of your pieces are marked as in laundry. Bring them back when they're clean.",
  'wardrobe.allLaundry.cta': 'Open laundry',

  // ─── Plan ───────────────────────────────────────────────────────────────
  'plan.empty.title': 'Nothing planned',
  'plan.empty.body': 'Generate an outfit or pick from your saved looks.',
  'plan.empty.cta': 'Generate outfit',

  // ─── EditGarment (extended) ─────────────────────────────────────────────
  'editGarment.action.cancel': 'Cancel',
  'editGarment.action.save': 'Save',
  'editGarment.eyebrow': 'Edit',
  'editGarment.title': 'Edit piece',
  'editGarment.changePhoto': 'Change photo',
  'editGarment.changePhoto.alert.title': 'Coming soon',
  'editGarment.changePhoto.alert.body': 'Photo replacement lands in a future release.',
  'editGarment.section.details': 'Details',
  'editGarment.section.style': 'Style',
  'editGarment.section.usage': 'Usage',
  'editGarment.section.status': 'Status',
  'editGarment.toggle.on': 'On',
  'editGarment.toggle.off': 'Off',
  'editGarment.delete': 'Delete piece',
  'editGarment.deleting': 'Deleting…',
  'editGarment.a11y.decrementWear': 'Decrement wear count',
  'editGarment.a11y.incrementWear': 'Increment wear count',

  // ─── Home (extended) ────────────────────────────────────────────────────
  'home.greeting.night': 'Good night',
  'home.greeting.morning': 'Good morning',
  'home.greeting.afternoon': 'Good afternoon',
  'home.greeting.evening': 'Good evening',
  'home.alert.markedWorn.title': 'Marked worn',
  'home.alert.markedWorn.body': "Today's look saved to your wear log.",
  'home.alert.markWornError.title': 'Could not mark worn',
  'home.alert.markWornError.fallback': 'Please try again.',
  // Distinct from `home.todaysLook.restyle` so non-English locales can pick a
  // different verb when the destination is StyleMe (occasion-driven) vs
  // OutfitGenerate (full restyle of the planned look).
  'home.thisWeek.restyle': 'Restyle',

  // ─── Outfit actions (shared by PlanScreen + OutfitDetailScreen) ─────────
  'outfit.actions.markedWorn.title': 'Marked worn',
  'outfit.actions.markedWorn.body': 'Saved to your wear log.',
  'outfit.actions.couldNotMarkWorn.title': 'Could not mark worn',
  'outfit.actions.couldNotSave.title': 'Could not save',
  'outfit.actions.added.title': 'Added',
  'outfit.actions.added.body': "Outfit added to today's plan.",
  'outfit.actions.couldNotAddPlan.title': 'Could not add to plan',
  'outfit.actions.delete.title': 'Delete',
  'outfit.actions.delete.body': 'Delete this outfit? This cannot be undone.',
  'outfit.actions.delete.cancel': 'Cancel',
  'outfit.actions.delete.confirm': 'Delete',
  'outfit.actions.couldNotDelete.title': 'Could not delete',
  'outfit.detail.notFound.title': 'Outfit not found',
  'outfit.detail.notFound.body': 'This look may have been removed. Go back and pick another.',

  // ─── Plan — clear-plan flow ─────────────────────────────────────────────
  'plan.clearPlan.confirm.title': 'Clear plans',
  'plan.clearPlan.confirm.body': 'This will remove the planned outfit for this day.',
  'plan.clearPlan.confirm.cancel': 'Cancel',
  'plan.clearPlan.confirm.confirm': 'Clear',
  'plan.clearPlan.success.title': 'Cleared',
  'plan.clearPlan.success.body': 'Planned outfit cleared.',
  'plan.clearPlan.error.title': 'Could not clear',

  // ─── Common ─────────────────────────────────────────────────────────────
  'common.alerts.tryAgain': 'Please try again.',

  // ─── Style Me — weather ─────────────────────────────────────────────────
  'styleMe.weather.alert.title': 'Weather',
  'styleMe.weather.alert.body': 'Weather customisation coming soon.',

  // ─── Travel — G3 (multi-select Occasions + per-day outfits) ─────────────
  'travel.occasions.title': 'Occasions',
  'travel.occasions.work': 'Work',
  'travel.occasions.dinner': 'Dinner',
  'travel.occasions.beach': 'Beach',
  'travel.occasions.hiking': 'Hiking',
  'travel.occasions.nightlife': 'Nightlife',
  'travel.occasions.wedding': 'Wedding',
  'travel.occasions.sightseeing': 'Sightseeing',
  'travel.occasions.airport': 'Airport',
  'travel.occasions.active': 'Active',
  'travel.outfits.tab': 'Outfits',
  'travel.outfits.dayLabel': 'Day {day}',
  'travel.savedCapsules.empty': 'Build your first trip and it lands here.',
  'travelPackingList.tabPacking': 'Packing',

  // ─── G1 — Chat history sheet, mode toggle, outfit suggestion card ────────
  'chat.history.title': 'Past chats',
  'chat.history.eyebrow': 'History',
  'chat.history.empty': 'No past chats yet',
  'chat.history.previewEmpty': 'No messages yet',
  'chat.history.loading': 'Loading…',
  'chat.history.openLabel': 'Open chat history',
  'chat.history.close': 'Close history',
  'chat.history.messageCount.template': '{n} messages',
  // Parity-C — single header menu replaces the old two-icon header.
  'chat.menu.openLabel': 'Chat menu',
  'chat.menu.history': 'Open history',
  'chat.menu.newChat': 'Start new chat',
  // Parity-C — per-row delete inside ChatHistorySheet.
  'chat.history.delete.action': 'Delete',
  'chat.history.delete.confirm.title': 'Delete this chat?',
  'chat.history.delete.confirm.body':
    'This removes every message in this thread. You can’t undo this.',
  'chat.history.delete.confirm.cancel': 'Keep',
  'chat.history.delete.confirm.delete': 'Delete',
  'chat.history.delete.failed.title': 'Couldn’t delete',
  'chat.outfitCard.try': 'Try this outfit',
  'chat.outfitCard.eyebrow': 'Suggestion',
  'chat.outfitCard.name.suggestion': 'Today’s pick',
  'chat.outfitCard.name.saved': 'Saved outfit',
  'chat.outfitCard.loading': 'Loading outfit…',
  // Parity-D — Save CTA on the inline OutfitSuggestionCard + wardrobe→chat push.
  'chat.outfitCard.save': 'Save',
  'chat.outfitCard.saving': 'Saving…',
  'chat.outfitCard.saved': 'Saved',
  'chat.outfitCard.saveSuccess.title': 'Saved',
  'chat.outfitCard.saveSuccess.body': 'This look lives in Outfits now.',
  'chat.outfitCard.saveFailed.title': 'Couldn’t save',
  'chat.outfitCard.saveEmpty.title': 'Nothing to save',
  'chat.outfitCard.saveEmpty.body': 'This suggestion has no garments to save.',
  // Q-D2 — chat refine mode UX (lock-a-piece-then-restyle parity with web).
  'chat.outfitCard.refine': 'Refine',
  'chat.outfitCard.refine.cancel': 'Cancel',
  'chat.refine.hint': 'Tap pieces to lock them, then send a refine prompt.',
  'a11y.outfitCard.tile.locked': 'Locked piece — tap to unlock',
  'a11y.outfitCard.tile.lockable': 'Tap to lock this piece',
  'garmentDetail.styleInChat.action': 'Style this in chat',
  'chat.modeToggle.style': 'Style',
  'chat.modeToggle.shopping': 'Shop',

  // ─── G4 — Wardrobe Gaps "Find similar" CTA ──────────────────────────────
  'pickMustHaves.findSimilar': 'Find similar',

  // ─── Style Me (G5) — adjust weather, occasion/formality parity, anchor, save ─
  'styleMe.weather.adjustTitle': 'Adjust weather',
  'styleMe.weather.tempLabel': 'Temperature',
  'styleMe.weather.conditionLabel': 'Condition',
  'styleMe.weather.condition.clear': 'Clear',
  'styleMe.weather.condition.cloudy': 'Cloudy',
  'styleMe.weather.condition.rain': 'Rain',
  'styleMe.weather.condition.snow': 'Snow',
  'styleMe.weather.adjust.cta': 'Adjust',
  'styleMe.weather.adjust.done': 'Done',
  'styleMe.weather.adjust.reset': 'Reset to live',
  'styleMe.weather.fallbackLine': '— · current weather',
  'styleMe.occasion.casual': 'Casual',
  'styleMe.occasion.work': 'Work',
  'styleMe.occasion.evening': 'Evening',
  'styleMe.occasion.date': 'Date',
  'styleMe.occasion.workout': 'Workout',
  'styleMe.occasion.travel': 'Travel',
  'styleMe.occasion.custom': 'Custom…',
  'styleMe.occasion.customPlaceholder': 'Type an occasion',
  'styleMe.occasion.casual.sub': 'Errands, weekends',
  'styleMe.occasion.work.sub': 'Office, meetings',
  'styleMe.occasion.evening.sub': 'Out late',
  'styleMe.occasion.date.sub': 'A bit considered',
  'styleMe.occasion.workout.sub': 'Move-friendly',
  'styleMe.occasion.travel.sub': 'Light, layered',
  'styleMe.formality.formalOffice': 'Formal Office',
  'styleMe.formality.businessCasual': 'Business Casual',
  'styleMe.formality.relaxedOffice': 'Relaxed Office',
  'styleMe.formality.baseline': 'Baseline',
  'styleMe.anchor.title': 'Anchor a piece',
  'styleMe.anchor.cta': 'Pick',
  'styleMe.anchor.empty': 'No piece anchored',
  'styleMe.anchor.clear': 'Clear',
  'styleMe.anchor.sheetTitle': 'Pick an anchor piece',
  'styleMe.anchor.sheetClose': 'Close',
  'styleMe.saved.badge': 'Saved ✓',
  'styleMe.saved.openDetail': 'Open detail',
  'styleMe.saved.error.title': 'Could not save',
  'styleMe.preview.badge': 'Preview',

  // ─── N3.8 — G-campaign post-merge polish ─────────────────────────────────
  'travel.outfits.dateUnknown': 'Date unavailable',

  // ─── N3.10 functional bug sweep (2026-05-09) ───────────────────────────
  // FiltersScreen — back-without-Apply confirmation (F-007).
  'filters.discardChanges.title': 'Discard filter changes?',
  'filters.discardChanges.body':
    "You haven't applied your changes yet. Going back will discard them.",
  'filters.discardChanges.keepEditing': 'Keep editing',
  'filters.discardChanges.discard': 'Discard',
  // PhotoFeedbackScreen — missing outfitId guard (F-010).
  'photoFeedback.missingOutfit.title': "Couldn't open photo feedback",
  'photoFeedback.missingOutfit.body':
    'No outfit was provided for this selfie. Open photo feedback from an outfit to try again.',
  // OutfitPoolScreen — surface failed-draft names in the partial-save toast (F-009).
  'outfitPool.partialSaveBodyWithNames':
    "{failed} couldn't be saved — try again. Failed: {names}",

  // ─── Settings · Edit profile (N3.9) ────────────────────────────────────
  // Reached from SettingsAccount's Full Name row + avatar Edit Photo link.
  // Pre-N3.9 those CTAs popped Coming Soon alerts — App Review blocker.
  'settings.profileEdit.eyebrow': 'Settings',
  'settings.profileEdit.title': 'Edit profile',
  'settings.profileEdit.save': 'Save',
  'settings.profileEdit.section.name': 'Name',
  'settings.profileEdit.section.photo': 'Profile photo',
  'settings.profileEdit.field.displayName': 'Display name',
  'settings.profileEdit.field.displayName.placeholder': 'Your name',
  'settings.profileEdit.field.displayName.helper':
    'This is the name we show across the app — outfit cards, the home greeting, and your account.',
  'settings.profileEdit.photo.deferred.title': 'Photo upload available in a future update',
  'settings.profileEdit.photo.deferred.body':
    'Your initial is shown for now. Photo uploads will land in a follow-up release.',
  'settings.profileEdit.error.title': 'Could not save',
  'settings.profileEdit.error.body': 'Please check your connection and try again.',

  // ─── M38 — SettingsStyle 8-section editor ────────────────────────────────
  // Append-only. Each section heading + help copy + summary template. Apply
  // / Save-all action labels. Keys mirror the SECTION_IDS literal-union in
  // SettingsStyleScreen.tsx.
  'settingsStyle.editor.section.archetype.title': 'Archetype',
  'settingsStyle.editor.section.formality.title': 'Formality range',
  'settingsStyle.editor.section.palette.title': 'Color palette',
  'settingsStyle.editor.section.fits.title': 'Fits',
  'settingsStyle.editor.section.occasions.title': 'Occasions',
  'settingsStyle.editor.section.vibes.title': 'Vibes',
  'settingsStyle.editor.section.pattern.title': 'Pattern comfort',
  'settingsStyle.editor.section.disliked.title': 'Disliked colors',
  'settingsStyle.editor.archetype.help': 'Pick {min}-{max} archetypes that anchor your style.',
  'settingsStyle.editor.formality.help':
    'Set the dressed-down floor and dressed-up ceiling for your wardrobe.',
  'settingsStyle.editor.formality.floor': 'Floor',
  'settingsStyle.editor.formality.ceiling': 'Ceiling',
  'settingsStyle.editor.formality.summaryTemplate': '{floor}% – {ceiling}%',
  'settingsStyle.editor.palette.help': 'Pick up to {max} colors you wear most.',
  'settingsStyle.editor.fits.help': 'Choose the cut you reach for most often.',
  'settingsStyle.editor.occasions.help': 'Tag every occasion you dress for.',
  'settingsStyle.editor.vibes.help': 'Pick the tone that best fits your color palette.',
  'settingsStyle.editor.pattern.help': 'How much pattern do you actually wear?',
  'settingsStyle.editor.pattern.choice.love': 'Love patterns',
  'settingsStyle.editor.pattern.choice.some': 'Some patterns',
  'settingsStyle.editor.pattern.choice.minimal': 'Minimal',
  'settingsStyle.editor.pattern.choice.solids_only': 'Solids only',
  'settingsStyle.editor.disliked.help': 'Pick up to {max} colors to avoid.',
  'settingsStyle.editor.disliked.summaryTemplate': '{count} avoided',
  'settingsStyle.editor.apply.label': 'Apply',
  'settingsStyle.editor.apply.busy': 'Saving…',
  'settingsStyle.editor.saveAll.label': 'Save all',
  'settingsStyle.editor.saveAll.busy': 'Saving…',
  'settingsStyle.editor.saveError.title': "Couldn't save",
  'settingsStyle.editor.saveError.body': "Couldn't save your changes. Try again.",
  'settingsStyle.editor.saveError.retry': 'Retry',
  'settingsStyle.editor.saveError.cancel': 'Cancel',
  'settingsStyle.editor.unsavedDot': 'Unsaved changes',

  // ─── N8 — Hardcoded English strings sweep (Sweden launch blocker) ──────
  // Append-only batch of new keys introduced by the N8 mobile-screens sweep
  // that replaced literal English strings with `tr(...)` calls. Pairs with
  // the matching block at the bottom of `sv.ts`.

  // HomeScreen — header avatar a11y (Profile button).
  'home.profile.aria': 'Profile',

  // NotificationsScreen — header eyebrow / page title / mark-all-read CTA /
  // empty-state title + body. Hardcoded English replaced in the N8 sweep.
  'notifications.eyebrow': 'Inbox',
  'notifications.title': 'Notifications',
  'notifications.markAllRead': 'Mark all read',
  'notifications.empty.title': 'All quiet',
  'notifications.empty.body':
    "No notifications yet. We'll ping you when there's something worth your eyes.",

  // SearchScreen — placeholder / clear / category chips / recent block /
  // empty + result-count strings. Replaces a CAT_LABELS array of literals
  // and ad-hoc result-count templating.
  'search.placeholder': 'Search wardrobe…',
  'search.clear': 'Clear search',
  'search.cat.all': 'All',
  'search.cat.tops': 'Tops',
  'search.cat.bottoms': 'Bottoms',
  'search.cat.shoes': 'Shoes',
  'search.cat.outer': 'Outer',
  'search.cat.dress': 'Dress',
  'search.recent.eyebrow': 'Recent',
  'search.recent.clear': 'Clear all',
  'search.recent.clearAria': 'Clear recent searches',
  'search.recent.itemAria': 'Search for {query}',
  'search.results.noMatches': 'No matches',
  'search.results.countOne': '{count} result',
  'search.results.countOther': '{count} results',
  'search.empty.title': 'Nothing found',
  'search.empty.body': 'Try a different search term.',
  'search.hint.minChars': 'Type at least {count} characters to search your wardrobe.',

  // InsightsScreen — title, stat labels, palette + wear-frequency cards,
  // most-worn header, quiet-win quote, empty-state CTA.
  'insights.title': 'Insights',
  'insights.empty.title': 'Add garments to see insights',
  'insights.empty.body': 'Scan your first piece to start building your wardrobe profile.',
  'insights.empty.cta': 'Add a piece',
  'insights.stat.outfitsWorn': 'Outfits worn',
  'insights.stat.wardrobeUsed': 'Wardrobe used',
  'insights.palette.title': 'Your palette',
  'insights.palette.caption': 'Share by colour',
  'insights.wearFrequency.title': 'Wear frequency',
  'insights.wearFrequency.caption': 'Last 7 days',
  'insights.wearFrequency.empty': 'No wears logged in the last week.',
  'insights.mostWorn.title': 'Most worn',
  'insights.quietWin.title': 'Quiet win',
  // Quote rendered as `prefix <accent>{money}</accent> suffix` so the
  // currency-formatted value can be coloured without breaking the
  // sentence. Translators should keep the leading/trailing whitespace
  // intact when localizing.
  'insights.quietWin.prefix': 'Average cost-per-wear is',
  'insights.quietWin.suffix': 'across your priced pieces.',

  // ProfileScreen — settings rows for account + style profile.
  'profile.row.account.title': 'Account settings',
  'profile.row.account.caption': 'Email, password, connected accounts',
  'profile.row.style.title': 'Style profile',
  'profile.row.style.caption': 'Aesthetic, sizes, color preferences',

  // MonthCalendarScreen — planned-day actions + empty-state copy.
  'monthCalendar.planned.fallbackName': 'Planned outfit',
  'monthCalendar.planned.view': 'View outfit',
  'monthCalendar.planned.change': 'Change',
  'monthCalendar.empty.title': 'Nothing planned',
  'monthCalendar.empty.body': 'Generate an outfit or plan one manually.',
  'monthCalendar.empty.cta': 'Generate outfit',

  // SettingsAppearanceScreen — header eyebrow + section eyebrow keys.
  'settings.appearance.headerEyebrow': 'Settings',
  'settings.appearance.headerTitle': 'Appearance',
  'settings.appearance.theme.eyebrow': 'Theme',

  // SettingsNotificationsScreen — header eyebrow + page title.
  'settings.notifications.headerEyebrow': 'Settings',
  'settings.notifications.headerTitle': 'Notifications',

  // SettingsStyleScreen — 4 row titles + 2 captions (the rest had captions
  // that come from live data already).
  'settingsStyle.row.retakeQuiz.title': 'Retake style quiz',
  'settingsStyle.row.retakeQuiz.caption': 'Refresh your DNA from scratch',
  'settingsStyle.row.editStyleWords.title': 'Edit style words',
  'settingsStyle.row.editColorPreferences.title': 'Edit color preferences',
  'settingsStyle.row.resetMemory.title': 'Reset style memory',
  'settingsStyle.row.resetMemory.caption': 'Forget what BURS has learned',

  // SettingsAccountScreen — support email, sourced from i18n so a future
  // per-market inbox (e.g. support-se@burs.me) is a translation update.
  'settings.account.supportEmail': 'support@burs.me',

  // ─── N8 — accessibility a11y labels ─────────────────────────────────────
  // GarmentCard + OutfitCard render a synthesized accessibilityLabel so
  // VoiceOver/TalkBack announce the garment's identity instead of just
  // "Image". Templates kept loose so the same string works for cards
  // missing a color or category.
  'a11y.garmentCard': '{name}, {color} {category}',
  'a11y.garmentCard.noColor': '{name}, {category}',
  'a11y.garmentCard.noCategory': '{name}, {color}',
  'a11y.garmentCard.nameOnly': '{name}',
  'a11y.outfitCard': '{name}, {pieceCount} pieces',
  'a11y.outfitCard.nameOnly': '{name}',

  // ─── M40 — native Privacy Policy + Terms screens ────────────────────────
  // The screen chrome (eyebrows, "view web version" footer, web-fallback
  // error alert) lives here; the long-form body copy is in
  // mobile/src/lib/legalContent.ts so the locale file doesn't balloon.
  // SettingsPrivacyScreen exposes a second CTA ("Read terms of service")
  // alongside the existing privacy CTA — `settings.privacy.info.cta.terms`.
  // AuthScreen sign-up disclosure now exposes Terms + Privacy as discrete
  // tappable links under the existing static caption.
  'legal.privacy.eyebrow': 'Legal',
  'legal.terms.eyebrow': 'Legal',
  'legal.webVersion': 'View web version',
  'legal.webVersion.label': 'Open the web version of this document',
  'legal.webPrivacyUrl': 'https://burs.me/privacy',
  'legal.webTermsUrl': 'https://burs.me/terms',
  'legal.webError.title': 'Could not open',
  'legal.webError.body':
    'Unable to open the web version. The native screen above is the canonical document.',
  'settings.privacy.info.cta.terms': 'Read terms of service',
  'auth.signUp.terms.link': 'Terms',
  'auth.signUp.terms.label': 'Open terms of service',
  'auth.signUp.privacy.link': 'Privacy',
  'auth.signUp.privacy.label': 'Open privacy policy',

  // ─── M39 — locale-aware paywall pricing ─────────────────────────────────
  // PaywallScreen now derives the displayed price from
  // `mobile/src/lib/localizedPricing.ts` rather than the hardcoded
  // "119 SEK" / "899 SEK" template the M31 keys use. The new keys below
  // are the locale-templated companions: short period suffixes ("/ month")
  // for the plan toggle pills, a price+period composition template, and a
  // trial-line template that interpolates the localized price.
  //
  // The legacy `paywall.monthly.priceLabel` / `paywall.yearly.priceLabel` /
  // `paywall.trial.monthly` / `paywall.trial.yearly` / `paywall.price.monthly`
  // / `paywall.price.yearly` keys remain in the dictionary (append-only
  // contract) but are no longer read by the screen.
  'paywall.price.perMonthShort': '/ month',
  'paywall.price.perYearShort': '/ year',
  'paywall.pricing.priceLabel.template': '{price} {period}',
  'paywall.trial.template': '3 days free, then {price} {period}',
  // Loading placeholders shown on the plan pills + headline while RC
  // offerings hydrate. Acceptance #6: no hardcoded SEK literal flashes
  // while the storefront price is in flight.
  'paywall.pricing.priceLabel.loading': 'Loading price…',
  'paywall.pricing.loading': 'Loading price',
  // Suffix used after RC's verbatim intro-price label (e.g. "Free for
  // 3 days, then 119 kr per month"). Renders the trial line in two
  // pieces so the StoreKit-localized intro string survives untouched.
  'paywall.trial.thenSuffix': 'then {price} {period}',

  // ─── M41 — Notifications inbox + ShareOutfit ───────────────────────────
  // Append-only block for the M41 wave. NotificationsScreen now reads real
  // rows from the `notifications` table; OutfitDetailScreen has a Share
  // action that opens the OS share sheet with a deep-link to the outfit.

  // Inbox states beyond the existing N8 keys above.
  'notifications.error.title': "Couldn't load notifications",
  'notifications.error.body': 'Pull to retry, or come back in a moment.',

  // Relative-time labels rendered next to each row. The hook returns a
  // bucket key ('justNow', 'minutesAgo', 'hoursAgo', 'daysAgo') and the
  // screen renders the matching label with the count interpolated in.
  'notifications.time.justNow': 'Just now',
  'notifications.time.minutesAgo': '{count}m ago',
  'notifications.time.hoursAgo': '{count}h ago',
  'notifications.time.daysAgo': '{count}d ago',

  // Header Share IconBtn a11y.
  'outfit.detail.share.aria': 'Share outfit',

  // useShareOutfit message scaffolding. The {link} placeholder is replaced
  // with the burs.me deep-link before the OS share sheet renders, so the
  // message reads "Check out my BURS outfit \"<name>\": https://burs.me/...".
  'share.outfit.message': 'Check out my BURS outfit "{name}": {link}',
  'share.outfit.dialogTitle': 'Share outfit',
  'share.outfit.error.title': "Couldn't share",
  'share.outfit.error.body': "Something stopped the share sheet. Give it another go.",

  // Bell icon in HomeScreen header — entry point to NotificationsScreen.
  // Codex P1 follow-up on PR #809: route was wired but unreachable.
  'home.notifications.aria': 'Open notifications',

  // ============ N3b — Alert→toast sweep + EditGarment cancel-confirm i18n ============
  // New keys appended below; existing keys above are unchanged. Append-only.

  // OutfitDetail toast copy (transient errors that previously rendered as
  // English-literal Alert.alert dialogs).
  'outfitDetail.toast.couldNotAddAccessory': 'Could not add accessory',
  'outfitDetail.toast.couldNotSaveAnchor': 'Could not save anchor',
  'outfitDetail.toast.couldNotSwap': 'Could not swap',
  'outfitDetail.toast.couldNotRemove': 'Could not remove',
  'outfitDetail.toast.couldNotSaveNote': 'Could not save note',

  // OutfitGenerate — informational placeholder ("real saving lands later").
  // Kept for any legacy callers; the persist flow uses the keys below.
  'outfitGenerate.toast.savedAsPreview.title': 'Saved as preview',
  'outfitGenerate.toast.savedAsPreview.body':
    'Persistent saving lands in a future update. For now this is a preview.',

  // MoodFlow + OutfitGenerate — real Save/Wear persistence (parity sweep B).
  'moodFlow.save.action': 'Save look',
  'moodFlow.save.busy': 'Saving…',
  'moodFlow.save.saved': 'Saved',
  'moodFlow.save.success.title': 'Saved',
  'moodFlow.save.success.body': 'Your look lives in Outfits now.',
  'moodFlow.save.failed.title': 'Couldn’t save',
  'moodFlow.save.empty.title': 'Nothing to save yet',
  'moodFlow.save.empty.body': 'The look has no garments to save.',
  'moodFlow.wear.action': 'Wear this',
  'moodFlow.wear.busy': 'Working…',
  'moodFlow.wear.failed.title': 'Couldn’t mark worn',
  'moodFlow.restyle.action': 'Restyle',
  'outfitGenerate.save.action': 'Save outfit',
  'outfitGenerate.save.busy': 'Saving…',
  'outfitGenerate.save.saved': 'Saved',
  'outfitGenerate.save.success.title': 'Saved',
  'outfitGenerate.save.success.body': 'Your outfit lives in Outfits now.',
  'outfitGenerate.save.failed.title': 'Couldn’t save',
  'outfitGenerate.save.empty.title': 'Nothing to save yet',
  'outfitGenerate.save.empty.body': 'The outfit has no garments to save.',
  'outfitGenerate.wear.action': 'Wear today',
  'outfitGenerate.wear.busy': 'Working…',
  'outfitGenerate.wear.failed.title': 'Couldn’t mark worn',
  // Q-B — Plan for a date CTA + planner sheet copy.
  'outfitGenerate.plan.action': 'Plan for a date',
  'outfitGenerate.plan.failed.title': 'Couldn’t save outfit',
  'plannerSheet.eyebrow': 'Plan this outfit',
  'plannerSheet.title': 'Pick a day',
  'plannerSheet.confirm': 'Confirm',
  'plannerSheet.success.title': 'Planned',
  'plannerSheet.success.body': 'This outfit is on your plan now.',
  'plannerSheet.failed.title': 'Couldn’t save plan',

  // Wardrobe wishlist tile — informational placeholder.
  'wardrobe.wishlist.comingSoon.title': 'Coming soon',
  'wardrobe.wishlist.comingSoon.body': 'Wishlist feature coming soon.',
  // Q-C2 — Wishlist + Lingerie tile tap-toasts (filtered list view
  // deferred). Plus the GarmentDetail toggle labels that let the user
  // flip the new personal flags on a per-garment basis.
  'wardrobe.wishlist.title': 'On your wishlist',
  'wardrobe.wishlist.body.template': '{count} pieces flagged. Filter view arrives in a future update.',
  'wardrobe.lingerie.title': 'Lingerie',
  'wardrobe.lingerie.body.template': '{count} pieces flagged. Filter view arrives in a future update.',
  'garmentDetail.flag.wishlist.label': 'Wishlist',
  'garmentDetail.flag.wishlist.hint': 'Track pieces you want to buy.',
  'garmentDetail.flag.lingerie.label': 'Lingerie',
  'garmentDetail.flag.lingerie.hint': 'Organize delicates separately in your wardrobe.',

  // EditGarment cancel-confirm (N9 deferral folded in here per the N3b
  // brief). KEEP as Alert.alert: discard-vs-keep is a destructive choice.
  'editGarment.cancel.confirm.title': 'Discard changes?',
  'editGarment.cancel.confirm.body': 'You have unsaved edits to this piece.',
  'editGarment.cancel.confirm.keep': 'Keep editing',
  'editGarment.cancel.confirm.discard': 'Discard',

  // EditGarment validation + transient errors (toasts).
  'editGarment.invalidPrice.title': 'Invalid price',
  'editGarment.invalidPrice.body': 'Price must be a non-negative number.',
  'editGarment.saveFailed.title': 'Save failed',
  'editGarment.saveFailed.fallback': 'Could not save changes. Try again.',
  'editGarment.deleteFailed.title': 'Delete failed',

  // ─── N12 — Generate garment image (manual-entry rescue) ────────────
  'garment.generateImage.empty': 'No photo yet — generate a catalog-style image from the garment details.',
  'garment.generateImage.action': 'Generate image',
  'garment.generateImage.busy': 'Generating…',
  'garment.generateImage.error': "Couldn't generate an image right now. Try again in a moment.",

  // ─── N14 — Studio render failure badge ─────────────────────────────
  'garment.render.failed': 'Render unavailable',
  'garment.render.failed.a11y': 'Studio render unavailable',

  // ─── N16 — i18n closeout (Alert.alert + Text hold-outs) ────────────
  'garmentDetail.alerts.couldNotLogWear.title': 'Could not log wear',
  'garmentDetail.alerts.couldNotMove.title': 'Could not move',
  'garmentDetail.alerts.tryAgain': 'Try again.',
  'garmentDetail.alerts.delete.title': 'Delete',
  'garmentDetail.alerts.delete.body': 'Delete this garment? This cannot be undone.',
  'garmentDetail.alerts.deleteFailed.title': 'Delete failed',
  'garmentDetail.alerts.couldNotMarkClean.title': 'Could not mark clean',
  'garmentDetail.alerts.options.title': 'Options',
  'garmentDetail.menu.markClean': 'Mark clean',
  'garmentDetail.menu.addToLaundry': 'Add to laundry',
  // Q-C2 — personal-flag menu items.
  'garmentDetail.menu.addToWishlist': 'Add to wishlist',
  'garmentDetail.menu.removeFromWishlist': 'Remove from wishlist',
  'garmentDetail.menu.markLingerie': 'Mark as lingerie',
  'garmentDetail.menu.unmarkLingerie': 'Unmark as lingerie',
  'garmentDetail.alerts.couldNotUpdate.title': 'Could not update',
  'garmentDetail.menu.deleteGarment': 'Delete garment',
  'garmentDetail.badge.studio': 'Studio',
  'garmentDetail.badge.studioRendering': 'Studio render…',
  'garmentDetail.badge.studioRendering.a11y': 'Studio render in progress',
  'laundry.alerts.markAllClean.title': 'Mark all clean?',
  'laundry.alerts.markAllClean.body': '{count} pieces will be moved out of laundry.',
  'laundry.alerts.markAllClean.cta': 'Mark all clean',
  'laundry.alerts.couldNotMarkClean.title': 'Could not mark clean',
  'laundry.alerts.partialFailure.title': 'Some items failed',
  'laundry.alerts.partialFailure.body': "{failures} of {total} couldn't be marked clean. Pull down to refresh and try the failed rows again.",
  'livescan.alerts.captureFailed.title': 'Capture failed',
  'livescan.alerts.captureFailed.body': 'Try again.',
  'livescan.alerts.permission.title': 'Permission needed',
  'livescan.alerts.permission.body': 'Grant photo access to import from your gallery.',
  'livescan.alerts.galleryUnavailable.title': 'Gallery unavailable',
  'livescan.alerts.galleryUnavailable.body': 'Could not open the photo library.',
  'outfitDetail.menu.options': 'Options',
  'outfitDetail.menu.addToPlan': 'Add to plan',
  'outfitDetail.menu.deleteOutfit': 'Delete outfit',
  'garmentCard.badge.laundry': 'Laundry',
};
