// Swedish translations for the BURS mobile app — Sweden-first launch (M33).
//
// This is a partial dictionary. The runtime resolver in `mobile/src/lib/i18n.ts`
// reads `dict[key] ?? en[key] ?? key`, so any key not present here falls back to
// English at render time. That keeps this file honest: only keys that have been
// translated by a Swedish-literate author appear here. Untranslated keys are
// quietly served in English instead of being papered over with `// TODO`
// placeholder strings (which would look real to future agents and trick them
// into shipping fake content).
//
// Append-only — same convention as the web's locale files. New translations
// land here as additional keys; do not reorganize once shipped.

export const sv: Record<string, string> = {
  // ─── Splash ─────────────────────────────────────────────────────────────
  'splash.tagline': 'Din garderob. Förstådd.',

  // ─── Confirm modal primitive (used by reset memory + delete account) ───
  'confirmModal.instruction': 'Skriv {required} för att bekräfta.',
  'confirmModal.cancel': 'Avbryt',
  'confirmModal.pending': 'Arbetar…',

  // ─── Settings · destructive flows (existing keys) ──────────────────────
  'settings.delete_account.title': 'Ta bort konto',
  'settings.delete_account.body':
    'Detta tar permanent bort din garderob, dina outfits och din inlärda stil — varje bild, varje signal, varje preferens. Det går inte att ångra.',
  'settings.delete_account.confirm': 'Ta bort konto',
  'settings.delete_account.required': 'TA BORT',
  'settings.delete_account.error': 'Kunde inte ta bort ditt konto. Försök igen eller kontakta supporten.',

  'settings.reset_memory.title': 'Återställ stilminne',
  'settings.reset_memory.body':
    'BURS glömmer det den lärt sig om din smak — sparade plagg, byten, betyg och föreslå-aldrig-markeringar. Din garderob och dina outfits behålls.',
  'settings.reset_memory.confirm': 'Återställ minne',
  'settings.reset_memory.required': 'ÅTERSTÄLL',
  'settings.reset_memory.success.title': 'Stilminne rensat',
  'settings.reset_memory.success.body': 'BURS börjar om från början nästa gång du loggar in.',
  'settings.reset_memory.error': 'Kunde inte återställa stilminnet. Försök igen.',

  'settings.wardrobeBadgeTemplate': '{count} plagg',
  'settings.styleProfileEmpty': 'Bygg din DNA i stilprofilen',

  // ─── M4 — duplicate detection (existing) ────────────────────────────────
  'addpiece.duplicate.eyebrow': 'Dubblett?',
  'addpiece.duplicate.title': 'Redan i din garderob?',
  'addpiece.duplicate.body': 'Det här liknar {title} — du kanske redan äger det.',
  'addpiece.duplicate.bodyNoTitle': 'Det här liknar ett plagg du redan äger.',
  'addpiece.duplicate.viewExisting': 'Visa befintligt',

  // ─── shoppingChat — Theme 3 sweep adds sv for the visible card actions ─
  'shoppingChat.cardOpen': 'Öppna',
  'shoppingChat.cardOpenHint': 'Öppnar produktsidan i webbläsaren',
  'addpiece.duplicate.addAnyway': 'Lägg till ändå',

  // ─── Theme 3 (M33) — Settings hub bring-up ─────────────────────────────
  'common.cancel': 'Avbryt',
  'common.back': 'Tillbaka',
  'common.discard': 'Förkasta',
  'common.empty': '—',
  'settings.header.eyebrow': 'Konto',
  'settings.header.title': 'Inställningar',
  'settings.profile.fallbackName': 'Din profil',
  'settings.profile.aria': 'Profil',
  'settings.section.profile': 'Profil',
  'settings.section.style': 'Stil',
  'settings.section.app': 'App',
  'settings.section.accountData': 'Konto & data',
  'settings.section.legal': 'Juridiskt',
  'settings.row.language': 'Språk',
  'settings.languageAlert.title': 'Språk',
  'settings.languageAlert.body': 'Ändra språk i din stilprofil.',
  'settings.row.styleProfile': 'Stilprofil',
  'settings.row.resetMemory': 'Återställ stilminne',
  'settings.row.resetMemory.caption': 'Rensar bara inlärda preferenser',
  'settings.row.appearance': 'Utseende',
  'settings.row.appearance.value': 'System',
  'settings.row.notifications': 'Aviseringar',
  'settings.row.notifications.caption': 'Dagliga looks · väder · stylist',
  'settings.row.account': 'Konto',
  'settings.row.account.caption': 'E-post, lösenord, anslutna konton',
  'settings.row.privacy': 'Integritet & data',
  'settings.row.privacy.caption': 'Exportera, återställ minne, ta bort konto',
  'settings.row.privacyPolicy': 'Integritetspolicy',
  'settings.row.terms': 'Användarvillkor',
  'settings.row.appVersion': 'Appversion',
  'settings.signOut.label': 'Logga ut',
  'settings.signOut.confirm.title': 'Logga ut',
  'settings.signOut.confirm.body': 'Är du säker på att du vill logga ut?',
  'settings.footer': 'BURS · {version}',

  // SettingsAccount (Account screen)
  'settings.account.headerEyebrow': 'Inställningar',
  'settings.account.headerTitle': 'Konto',
  'settings.account.editPhoto': 'Redigera foto',
  'settings.account.comingSoon.title': 'Kommer snart',
  'settings.account.comingSoon.body': 'Profilbildsuppladdning kommer snart.',
  'settings.account.section.account': 'Konto',
  'settings.account.section.data': 'Data',
  'settings.account.row.fullName': 'Fullständigt namn',
  'settings.account.row.email': 'E-post',
  'settings.account.email.alert.title': 'E-post',
  'settings.account.email.alert.body': 'Kontakta {email} för att ändra e-postadressen på ditt konto.',
  'settings.account.email.alert.action': 'Mejla supporten',
  'settings.account.email.subject': 'Ändra e-post på konto',
  'settings.account.row.changePassword': 'Byt lösenord',
  'settings.account.row.connected': 'Anslutna konton',
  'settings.account.fullName.alert.title': 'Fullständigt namn',
  'settings.account.fullName.alert.body': 'Redigera ditt namn under Profil.',
  'settings.account.row.export': 'Exportera mina data',
  'settings.account.row.export.caption': 'Få en kopia som ZIP-arkiv',
  'settings.account.export.alert.title': 'Exportera',
  'settings.account.export.alert.body': 'Din dataexport mejlas till dig.',
  'settings.account.row.delete': 'Ta bort konto',
  'settings.account.row.delete.caption': 'Tar permanent bort all data',

  // SettingsPrivacy
  'settings.privacy.headerEyebrow': 'Inställningar',
  'settings.privacy.headerTitle': 'Integritet & data',
  'settings.privacy.info.eyebrow': 'Dina data',
  'settings.privacy.info.body':
    'BURS håller din garderob och stildata privat. Du kan exportera, återställa eller ta bort den när som helst.',
  'settings.privacy.info.cta': 'Läs integritetspolicyn',
  'settings.privacy.alert.title': 'Integritetspolicy',
  'settings.privacy.alert.body': 'Besök burs.me/privacy för att läsa hela policyn.',

  // ─── Theme 3 (M33) — AddPiece flow ─────────────────────────────────────
  // Step 1 (staging)
  'addpiece.step1.headerEyebrow': 'Nytt plagg',
  'addpiece.step1.headerTitle': 'Lägg till plagg',
  'addpiece.step1.permission.title': 'Behörighet krävs',
  'addpiece.step1.permission.body': 'Ge åtkomst till foton för att importera från ditt galleri.',
  'addpiece.step1.galleryError.title': 'Galleriet är otillgängligt',
  'addpiece.step1.galleryError.body': 'Kunde inte öppna fotobiblioteket.',
  'addpiece.step1.hero.eyebrow': 'Rekommenderat · enstaka plagg',
  'addpiece.step1.hero.title': 'Live-skanning',
  'addpiece.step1.hero.body': 'Lägg plagget på en plan yta — vi beskär och taggar det automatiskt.',
  'addpiece.step1.sourceEyebrow': 'Eller lägg till foton',
  'addpiece.step1.source.camera.label': 'Kamera',
  'addpiece.step1.source.camera.sub': 'Ta foto nu',
  'addpiece.step1.source.gallery.label': 'Galleri',
  'addpiece.step1.source.gallery.sub': 'Välj foton',
  'addpiece.step1.source.visualSearch.label': 'Sök med foto',
  'addpiece.step1.source.visualSearch.sub': 'Hitta liknande',
  'addpiece.step1.source.importLink.label': 'Importera från länk',
  'addpiece.step1.source.importLink.sub': 'Klistra in en URL',
  'addpiece.step1.counterEyebrow': 'Foton förberedda',
  'addpiece.step1.removePhoto': 'Ta bort foto',
  'addpiece.step1.addPhoto': 'Lägg till foto',
  'addpiece.step1.addLabel': 'Lägg till',
  'addpiece.step1.maxCaption': 'Upp till {max} foton · Privat för din garderob',
  'addpiece.step1.readyEyebrow': '{count} klara',
  'addpiece.step1.readyCaption': 'Vi taggar varje plagg automatiskt',
  'addpiece.step1.cta.first': 'Analysera första bilden',
  'addpiece.step1.cta.single': 'Analysera plagg',

  // Step 2 (analyzing)
  'addpiece.step2.headerEyebrow': 'Steg {current} av {total}',
  'addpiece.step2.headerTitle': 'Analyserar',
  'addpiece.step2.close': 'Stäng',
  'addpiece.step2.skip': 'Hoppa över',
  'addpiece.step2.phase.fabric': 'Läser tyget…',
  'addpiece.step2.phase.colors': 'Identifierar färger…',
  'addpiece.step2.phase.category': 'Identifierar kategori…',
  'addpiece.step2.phase.almost': 'Snart klart…',
  'addpiece.step2.phase.stillWorking': 'Arbetar fortfarande — snart klart…',
  'addpiece.step2.progress.batch': 'Foto {current} av {total}',
  'addpiece.step2.progress.single': 'Jobbar på det',
  'addpiece.step2.progress.body': 'Vi har ditt plagg klart om en stund.',
  'addpiece.step2.progress.batchNote':
    'Flerbildsbatch kommer snart — bara det första fotot analyseras i den här versionen. Resten behöver läggas till på nytt.',
  'addpiece.step2.error.title': 'Kunde inte analysera ditt foto',
  'addpiece.step2.error.body': 'Försök igen eller välj ett annat foto.',
  'addpiece.step2.error.noPhoto': 'Inget foto att analysera',
  'addpiece.step2.error.notSignedIn': 'Inte inloggad',
  'addpiece.step2.error.couldNotAnalyze': 'Kunde inte analysera fotot',
  'addpiece.step2.error.uploadFailed': 'Uppladdningen misslyckades',
  // Flerbildsbatch (M-batch wave). 'activeNote' ersätter den äldre 'batchNote'
  // kopian, som varnade om att endast det första fotot analyserades — den
  // nya pipelinen analyserar alla foton.
  'addpiece.step2.batch.activeNote':
    'Vi guidar dig genom varje foto. Nästa förbereds i bakgrunden.',
  'addpiece.step2.batch.skip': 'Hoppa över detta foto',
  'addpiece.step2.batch.retry': 'Försök igen',

  // Step 3 (review + save)
  'addpiece.step3.headerEyebrow': 'Steg 3 av 3',
  'addpiece.step3.headerTitle': 'Bekräfta',
  'addpiece.step3.rescan': 'Skanna om',
  'addpiece.step3.rescan.aria': 'Skanna ett annat foto',
  'addpiece.step3.detected': 'Identifierat',
  'addpiece.step3.untitled': 'Namnlöst',
  'addpiece.step3.confidence.high.aria': 'Hög AI-säkerhet — auto-identifierade fält ser korrekta ut',
  'addpiece.step3.confidence.low.aria': 'Låg AI-säkerhet — vänligen granska de auto-identifierade fälten',
  'addpiece.step3.confidence.high': 'Ser bra ut',
  'addpiece.step3.confidence.low': 'Granska noggrant',
  'addpiece.step3.titleLabel': 'Titel',
  'addpiece.step3.titlePlaceholder': 'Namnge plagget',
  'addpiece.step3.field.category': 'Kategori',
  'addpiece.step3.field.subcategory': 'Underkategori',
  'addpiece.step3.field.colorPrimary': 'Huvudfärg',
  'addpiece.step3.field.material': 'Material',
  'addpiece.step3.field.pattern': 'Mönster',
  'addpiece.step3.field.fit': 'Passform',
  // Deprecated 2026-05-07 — call sites moved to `common.empty`.
  'addpiece.step3.fieldEmpty': '—',
  'addpiece.step3.seasonsEyebrow': 'Säsonger',
  'addpiece.step3.season.spring': 'Vår',
  'addpiece.step3.season.summer': 'Sommar',
  'addpiece.step3.season.autumn': 'Höst',
  'addpiece.step3.season.winter': 'Vinter',
  'addpiece.step3.almostEyebrow': 'Snart klart',
  'addpiece.step3.almostBody': 'Vi fortsätter förfina i bakgrunden',
  'addpiece.step3.save': 'Spara',
  'addpiece.step3.saving': 'Sparar…',
  'addpiece.step3.save.aria': 'Spara plagg',
  'addpiece.step3.saving.aria': 'Sparar plagg',
  'addpiece.step3.fallback.body': 'Saknar analysdata.',
  'addpiece.step3.fallback.startOver': 'Börja om',
  'addpiece.step3.error.generic': 'Kunde inte spara. Försök igen.',
  'addpiece.step3.error.network': 'Ingen internetanslutning. Försök igen när du är online.',
  'addpiece.step3.error.duplicate': 'Det här plagget finns redan i din garderob.',
  'addpiece.step3.error.notSignedIn': 'Logga in igen innan du sparar.',
  'addpiece.step3.error.uploadLost': 'Uppladdningen blev inte klar. Tryck på Skanna om för att försöka igen.',
  'addpiece.step3.saveFailed.title': 'Sparandet misslyckades',
  'addpiece.step3.offline.title': 'Sparat offline',
  'addpiece.step3.offline.body': 'Vi sparar plagget så snart du är online igen.',
  'addpiece.step3.discard.title': 'Förkasta plagget?',
  'addpiece.step3.discard.body': 'Du förlorar fotot och AI-analysen. Du kan skanna om från Steg 1.',

  // Save-choice sheet (GarmentSaveChoiceSheet)
  'addpiece.save.eyebrow': 'Spara som',
  'addpiece.save.title': 'Spara plagget',
  'addpiece.save.body': 'Välj vilken version du vill spara. Båda alternativen sparar direkt.',
  'addpiece.save.studio.label': 'Studiokvalitet',
  'addpiece.save.studio.body': 'Spara nu och låt studioversionen bli klar i bakgrunden.',
  'addpiece.save.studio.aria': 'Spara med studiokvalitet — rendering klar i bakgrunden',
  'addpiece.save.original.label': 'Originalfoto',
  'addpiece.save.original.body': 'Spara fotot som det är, utan studiobearbetning.',
  'addpiece.save.original.aria': 'Spara med originalfotot — ingen studiorendering',

  // M32 — Återställ köp. M33 lägger till SV för befintliga paywall-nycklar.
  'settings.account.section.subscription': 'Prenumeration',
  'settings.account.row.restorePurchases': 'Återställ köp',
  'settings.account.row.restorePurchases.caption':
    'Återaktivera en tidigare prenumeration på det här Apple-ID:t.',
  'paywall.restored.body': 'Din prenumeration är aktiv igen.',
  'paywall.restoring': 'Återställer…',
  'paywall.restoreError.title': 'Kunde inte återställa köp',
  'paywall.restoreError.body':
    'Vi kunde inte nå App Store. Kontrollera anslutningen och försök igen.',

  // ============================================================
  // M33 — Swedish baseline (Sweden launch)
  // ============================================================
  // Append-only block translating in-scope keys from en.ts per the wave
  // file: Auth, ResetPassword, Onboarding (incl. quizV4 / studio /
  // achievement / reveal / coachTour / language / photoTutorial),
  // Profile, Paywall, Travel (capsule / mustHaves / packingList /
  // garmentPicker), VisualSearch, ImportFromLink. Out-of-scope keys
  // (chat / photoFeedback / condition / outfit* / wardrobe* / value /
  // home / pickMustHaves / settingsStyle / settingsNotifications) roll
  // forward to v1.0.1 — they fall through to en.ts via the resolver.

  // ─── Splash ─────────────────────────────────────────────────────────────
  'splash.wordmark': 'BURS',

  // ─── Auth ───────────────────────────────────────────────────────────────
  'auth.wordmark': 'BURS',
  'auth.signIn.eyebrow': 'Välkommen tillbaka',
  'auth.signUp.eyebrow': 'Skapa ditt konto',
  'auth.field.name': 'Fullständigt namn',
  'auth.field.email': 'E-post',
  'auth.field.password': 'Lösenord',
  'auth.forgotPassword': 'Glömt lösenordet?',
  'auth.signIn.cta': 'Logga in',
  'auth.signUp.cta': 'Skapa konto',
  'auth.signUp.terms': 'Genom att fortsätta godkänner du våra användarvillkor',
  'auth.divider.or': 'eller',
  'auth.google': 'Fortsätt med Google',
  'auth.toggle.haveAccount': 'Har du redan ett konto?',
  'auth.toggle.noAccount': 'Inget konto?',
  'auth.toggle.toSignIn': 'Logga in',
  'auth.toggle.toSignUp': 'Skapa konto',
  'auth.signIn.errorTitle': 'Inloggning misslyckades',
  'auth.signUp.errorTitle': 'Kontoskapande misslyckades',
  'auth.google.errorTitle': 'Google-inloggning misslyckades',
  'auth.error.nameRequired': 'Ange ditt namn.',
  'auth.error.emailInvalid': 'Ange en giltig e-postadress.',
  'auth.error.passwordShort': 'Lösenordet måste vara minst 6 tecken.',
  'auth.resetPassword.emailRequiredTitle': 'E-post krävs',
  'auth.resetPassword.emailRequiredBody':
    'Ange e-postadressen till ditt konto och tryck på "Glömt lösenordet?" igen.',
  'auth.resetPassword.errorTitle': 'Kunde inte skicka återställningsmejl',
  'auth.resetPassword.successTitle': 'Kolla din e-post',
  'auth.resetPassword.successBody':
    'Vi har skickat en återställningslänk till {email}. Den är giltig i 1 timme.',

  // ─── ResetPassword ──────────────────────────────────────────────────────
  'resetPassword.title': 'Välj ett nytt lösenord',
  'resetPassword.eyebrow': 'Nytt lösenord',
  'resetPassword.intro': 'Välj ett nytt lösenord att logga in med.',
  'resetPassword.newPasswordLabel': 'Nytt lösenord',
  'resetPassword.confirmPasswordLabel': 'Bekräfta lösenord',
  'resetPassword.cta': 'Uppdatera lösenord',
  'resetPassword.submitting': 'Uppdaterar…',
  'resetPassword.errorTitle': 'Kunde inte uppdatera ditt lösenord',
  'resetPassword.successTitle': 'Lösenordet uppdaterat',
  'resetPassword.successBody': 'Ditt lösenord har ändrats.',
  'resetPassword.tooShort': 'Lösenordet måste vara minst 6 tecken.',
  'resetPassword.mismatch': 'Lösenorden matchar inte.',
  'resetPassword.back': 'Tillbaka',

  // ─── Language step ──────────────────────────────────────────────────────
  'language.eyebrow': 'Välkommen till BURS',
  'language.title': 'Välj ditt språk',
  'language.continue': 'Fortsätt',

  // ─── ConfirmModal primitive ─────────────────────────────────────────────
  'confirmModal.eyebrow': 'Är du säker?',

  // ─── Onboarding ─────────────────────────────────────────────────────────
  'onboarding.back': 'Tillbaka',
  'onboarding.skip': 'Hoppa över',
  // QuizV4
  'onboarding.quizV4.title': 'Berätta hur du klär dig.',
  'onboarding.quizV4.intro':
    'Tolv snabba svar hjälper BURS att skräddarsy outfits, planering och vägledning kring din verklighet.',
  'onboarding.quizV4.continue': 'Fortsätt',
  'onboarding.quizV4.skip': 'Hoppa över',
  'onboarding.quizV4.back': 'Tillbaka',
  'onboarding.quizV4.progressTemplate': '{current} av {total}',
  'onboarding.quizV4.requiredHint': 'Svara för att fortsätta',
  // Q identity
  'onboarding.quizV4.q.identity.prompt': 'Lite om dig.',
  'onboarding.quizV4.q.identity.help':
    'Hjälper BURS föreslå snitt och passform som klär dig.',
  'onboarding.quizV4.q.identity.gender': 'Hur uttrycker du din stil?',
  'onboarding.quizV4.q.identity.height': 'Längd',
  'onboarding.quizV4.q.identity.heightDecrease': 'Minska längd',
  'onboarding.quizV4.q.identity.heightIncrease': 'Öka längd',
  'onboarding.quizV4.q.identity.cm': 'cm',
  'onboarding.quizV4.q.identity.build': 'Kroppstyp',
  'onboarding.quizV4.q.identity.ageRange': 'Åldersintervall',
  'onboarding.quizV4.choice.gender.feminine': 'Feminin',
  'onboarding.quizV4.choice.gender.masculine': 'Maskulin',
  'onboarding.quizV4.choice.gender.neutral': 'Neutral',
  'onboarding.quizV4.choice.gender.prefer_not': 'Vill inte uppge',
  'onboarding.quizV4.choice.build.slim': 'Smal',
  'onboarding.quizV4.choice.build.athletic': 'Atletisk',
  'onboarding.quizV4.choice.build.curvy': 'Kurvig',
  'onboarding.quizV4.choice.build.fuller': 'Fylligare',
  'onboarding.quizV4.choice.build.prefer_not': 'Vill inte uppge',
  'onboarding.quizV4.choice.ageRange.18-24': '18–24',
  'onboarding.quizV4.choice.ageRange.25-34': '25–34',
  'onboarding.quizV4.choice.ageRange.35-44': '35–44',
  'onboarding.quizV4.choice.ageRange.45-54': '45–54',
  'onboarding.quizV4.choice.ageRange.55-64': '55–64',
  'onboarding.quizV4.choice.ageRange.65+': '65+',
  // Q lifestyle
  'onboarding.quizV4.q.lifestyle.prompt': 'Hur fördelas din vecka?',
  'onboarding.quizV4.q.lifestyle.help':
    'Dra varje reglage så det ungefär speglar din tid. Totalen behöver inte bli 100.',
  'onboarding.quizV4.q.lifestyle.total': 'Totalt: {total}%',
  'onboarding.quizV4.choice.lifestyle.work': 'Jobb',
  'onboarding.quizV4.choice.lifestyle.social': 'Socialt',
  'onboarding.quizV4.choice.lifestyle.casual': 'Vardag',
  'onboarding.quizV4.choice.lifestyle.sport': 'Sport',
  'onboarding.quizV4.choice.lifestyle.evening': 'Kväll',
  // Q climate
  'onboarding.quizV4.q.climate.prompt': 'Var klär du dig?',
  'onboarding.quizV4.q.climate.help':
    'Så att väder och säsonger är inbakade i rekommendationerna från start.',
  'onboarding.quizV4.q.climate.homeCity': 'Hemstad (valfritt)',
  'onboarding.quizV4.q.climate.homeCityPlaceholder': 'Stockholm',
  'onboarding.quizV4.q.climate.climate': 'Klimat',
  'onboarding.quizV4.q.climate.secondaryCity': 'Reser ofta? (valfritt)',
  'onboarding.quizV4.q.climate.secondaryCityPlaceholder': 'London',
  'onboarding.quizV4.choice.climate.nordic': 'Nordiskt',
  'onboarding.quizV4.choice.climate.temperate': 'Tempererat',
  'onboarding.quizV4.choice.climate.mediterranean': 'Medelhavs',
  'onboarding.quizV4.choice.climate.tropical': 'Tropiskt',
  'onboarding.quizV4.choice.climate.desert': 'Ökenklimat',
  'onboarding.quizV4.choice.climate.varies': 'Varierande',
  // Q archetypes
  'onboarding.quizV4.q.archetypes.prompt': 'Välj dina stilord.',
  'onboarding.quizV4.q.archetypes.help': 'Välj 3–5 som känns rätt för dig.',
  'onboarding.quizV4.q.archetypes.range': 'Välj {min}–{max}',
  'onboarding.quizV4.q.archetypes.selected': '{count} valda',
  'onboarding.quizV4.q.archetypes.icons': 'Stilförebilder (valfritt)',
  'onboarding.quizV4.q.archetypes.iconsPlaceholder':
    't.ex. The Row, Phoebe Philo, Kanye',
  'onboarding.quizV4.choice.archetypes.minimal': 'Minimalistisk',
  'onboarding.quizV4.choice.archetypes.classic': 'Klassisk',
  'onboarding.quizV4.choice.archetypes.street': 'Street',
  'onboarding.quizV4.choice.archetypes.preppy': 'Preppy',
  'onboarding.quizV4.choice.archetypes.bohemian': 'Bohemisk',
  'onboarding.quizV4.choice.archetypes.sporty': 'Sportig',
  'onboarding.quizV4.choice.archetypes.edgy': 'Edgy',
  'onboarding.quizV4.choice.archetypes.romantic': 'Romantisk',
  'onboarding.quizV4.choice.archetypes.scandi': 'Skandinavisk',
  'onboarding.quizV4.choice.archetypes.avantgarde': 'Avantgarde',
  'onboarding.quizV4.choice.archetypes.workwear': 'Workwear',
  'onboarding.quizV4.choice.archetypes.soft': 'Mjuk',
  // Q colors
  'onboarding.quizV4.q.colors.prompt': 'Din färgvärld.',
  'onboarding.quizV4.q.colors.help':
    'Upp till 3 favoriter, upp till 3 att undvika.',
  'onboarding.quizV4.q.colors.favorites': 'Älskar att bära',
  'onboarding.quizV4.q.colors.disliked': 'Undvik',
  'onboarding.quizV4.q.colors.palette': 'Palettkänsla',
  'onboarding.quizV4.q.colors.pattern': 'Mönster',
  'onboarding.quizV4.choice.color.black': 'Svart',
  'onboarding.quizV4.choice.color.white': 'Vit',
  'onboarding.quizV4.choice.color.grey': 'Grå',
  'onboarding.quizV4.choice.color.navy': 'Marinblå',
  'onboarding.quizV4.choice.color.blue': 'Blå',
  'onboarding.quizV4.choice.color.beige': 'Beige',
  'onboarding.quizV4.choice.color.camel': 'Kamel',
  'onboarding.quizV4.choice.color.brown': 'Brun',
  'onboarding.quizV4.choice.color.olive': 'Oliv',
  'onboarding.quizV4.choice.color.green': 'Grön',
  'onboarding.quizV4.choice.color.red': 'Röd',
  'onboarding.quizV4.choice.color.burgundy': 'Vinröd',
  'onboarding.quizV4.choice.color.pink': 'Rosa',
  'onboarding.quizV4.choice.color.purple': 'Lila',
  'onboarding.quizV4.choice.color.orange': 'Orange',
  'onboarding.quizV4.choice.color.teal': 'Petrol',
  'onboarding.quizV4.choice.color.cream': 'Cream',
  'onboarding.quizV4.choice.color.denim': 'Denim',
  'onboarding.quizV4.choice.palette.neutrals': 'Neutralt',
  'onboarding.quizV4.choice.palette.bold': 'Djärvt',
  'onboarding.quizV4.choice.palette.dark': 'Mörkt',
  'onboarding.quizV4.choice.palette.pastels': 'Pastell',
  'onboarding.quizV4.choice.palette.earth': 'Jordtoner',
  'onboarding.quizV4.choice.palette.mixed': 'Blandat',
  'onboarding.quizV4.choice.pattern.love': 'Älskar mönster',
  'onboarding.quizV4.choice.pattern.some': 'Lite',
  'onboarding.quizV4.choice.pattern.minimal': 'Minimalt',
  'onboarding.quizV4.choice.pattern.solids_only': 'Bara enfärgat',
  // Q fit
  'onboarding.quizV4.q.fit.prompt': 'Passform & silhuett.',
  'onboarding.quizV4.q.fit.help':
    'Hur kläderna sitter på dig när det känns rätt.',
  'onboarding.quizV4.q.fit.overall': 'Övergripande passform',
  'onboarding.quizV4.q.fit.topVsBottom': 'Topp mot underdel',
  'onboarding.quizV4.q.fit.layering': 'Lagring',
  'onboarding.quizV4.q.fit.bodyFocus': 'Lyft fram',
  'onboarding.quizV4.choice.fitOverall.fitted': 'Passformad',
  'onboarding.quizV4.choice.fitOverall.regular': 'Vanlig',
  'onboarding.quizV4.choice.fitOverall.relaxed': 'Avslappnad',
  'onboarding.quizV4.choice.fitOverall.oversized': 'Oversize',
  'onboarding.quizV4.choice.fitOverall.mixed': 'Blandat',
  'onboarding.quizV4.choice.fitTopVsBottom.same': 'Samma över hela',
  'onboarding.quizV4.choice.fitTopVsBottom.fitted_top_loose_bottom':
    'Passformad topp, lös underdel',
  'onboarding.quizV4.choice.fitTopVsBottom.loose_top_fitted_bottom':
    'Lös topp, passformad underdel',
  'onboarding.quizV4.choice.fitTopVsBottom.mixed': 'Blandat',
  'onboarding.quizV4.choice.layering.minimal': 'Minimalt',
  'onboarding.quizV4.choice.layering.some': 'Lite',
  'onboarding.quizV4.choice.layering.love': 'Älskar det',
  'onboarding.quizV4.choice.bodyFocus.shoulders': 'Axlar',
  'onboarding.quizV4.choice.bodyFocus.waist': 'Midja',
  'onboarding.quizV4.choice.bodyFocus.legs': 'Ben',
  'onboarding.quizV4.choice.bodyFocus.none': 'Inget',
  // Q formality
  'onboarding.quizV4.q.formality.prompt': 'Hur formell kan du gå?',
  'onboarding.quizV4.q.formality.help':
    'Sätt din vanliga lägstanivå och ditt finaste tak.',
  'onboarding.quizV4.q.formality.floor': 'Vardagligt golv',
  'onboarding.quizV4.q.formality.ceiling': 'Formellt tak',
  // Q fabric
  'onboarding.quizV4.q.fabric.prompt': 'Tyg & känsla.',
  'onboarding.quizV4.q.fabric.help':
    'Välj det du gillar och det du undviker.',
  'onboarding.quizV4.q.fabric.preferred': 'Älskar att bära (upp till 3)',
  'onboarding.quizV4.q.fabric.sensitivities': 'Känsligheter',
  'onboarding.quizV4.q.fabric.care': 'Skötselpreferens',
  'onboarding.quizV4.choice.fabric.cotton': 'Bomull',
  'onboarding.quizV4.choice.fabric.wool': 'Ull',
  'onboarding.quizV4.choice.fabric.linen': 'Linne',
  'onboarding.quizV4.choice.fabric.silk': 'Siden',
  'onboarding.quizV4.choice.fabric.cashmere': 'Kashmir',
  'onboarding.quizV4.choice.fabric.denim': 'Denim',
  'onboarding.quizV4.choice.fabric.leather': 'Skinn',
  'onboarding.quizV4.choice.fabric.synthetic': 'Syntet',
  'onboarding.quizV4.choice.fabric.tencel': 'Tencel',
  'onboarding.quizV4.choice.fabric.jersey': 'Jersey',
  'onboarding.quizV4.choice.fabricSensitivity.wool_itchy': 'Ull kliar',
  'onboarding.quizV4.choice.fabricSensitivity.synthetic_avoid':
    'Undvik syntet',
  'onboarding.quizV4.choice.fabricSensitivity.linen_wrinkles':
    'Skrynklor i linne stör',
  'onboarding.quizV4.choice.fabricSensitivity.leather_avoid':
    'Undvik skinn',
  'onboarding.quizV4.choice.fabricSensitivity.silk_fragile':
    'Siden för ömtåligt',
  'onboarding.quizV4.choice.fabricSensitivity.none': 'Inga',
  'onboarding.quizV4.choice.care.easy_care': 'Lättskött',
  'onboarding.quizV4.choice.care.mixed': 'Blandat',
  'onboarding.quizV4.choice.care.high_maintenance_ok':
    'Skötselkrävande OK',
  // Q occasions
  'onboarding.quizV4.q.occasions.prompt':
    'När behöver du outfits mest?',
  'onboarding.quizV4.q.occasions.help': 'Välj alla som passar.',
  'onboarding.quizV4.choice.occasion.work': 'Jobb',
  'onboarding.quizV4.choice.occasion.casual': 'Vardag',
  'onboarding.quizV4.choice.occasion.date': 'Dejt',
  'onboarding.quizV4.choice.occasion.party': 'Fest',
  'onboarding.quizV4.choice.occasion.travel': 'Resa',
  'onboarding.quizV4.choice.occasion.workout': 'Träning',
  'onboarding.quizV4.choice.occasion.formal_event': 'Formell tillställning',
  'onboarding.quizV4.choice.occasion.weekend': 'Helg',
  // Q shopping
  'onboarding.quizV4.q.shopping.prompt': 'Hur shoppar du?',
  'onboarding.quizV4.q.shopping.help':
    'En grov bild av takt, budget och stil hjälper rekommendationerna.',
  'onboarding.quizV4.q.shopping.frequency': 'Hur ofta',
  'onboarding.quizV4.q.shopping.budget': 'Budget',
  'onboarding.quizV4.q.shopping.style': 'Shoppingstil',
  'onboarding.quizV4.choice.shoppingFrequency.rare': 'Sällan',
  'onboarding.quizV4.choice.shoppingFrequency.seasonal':
    'Säsongsvis',
  'onboarding.quizV4.choice.shoppingFrequency.monthly': 'Månadsvis',
  'onboarding.quizV4.choice.shoppingFrequency.frequent': 'Ofta',
  'onboarding.quizV4.choice.budget.budget': 'Budget',
  'onboarding.quizV4.choice.budget.mid': 'Mellan',
  'onboarding.quizV4.choice.budget.premium': 'Premium',
  'onboarding.quizV4.choice.budget.luxury': 'Lyx',
  'onboarding.quizV4.choice.budget.mixed': 'Blandat',
  'onboarding.quizV4.choice.shoppingStyle.planned': 'Planerat',
  'onboarding.quizV4.choice.shoppingStyle.impulse': 'Impulsivt',
  'onboarding.quizV4.choice.shoppingStyle.mixed': 'Blandat',
  // Q goal
  'onboarding.quizV4.q.goal.prompt': 'Vad ska BURS göra för dig?',
  'onboarding.quizV4.q.goal.help':
    'Välj det som spelar störst roll just nu.',
  'onboarding.quizV4.choice.goal.reduce_decisions.label':
    'Minska beslut',
  'onboarding.quizV4.choice.goal.reduce_decisions.caption':
    'Ett tydligt val varje morgon, ingen beslutströtthet.',
  'onboarding.quizV4.choice.goal.discover_style.label':
    'Upptäck min stil',
  'onboarding.quizV4.choice.goal.discover_style.caption':
    'Kombinationer och looker du inte hade provat på egen hand.',
  'onboarding.quizV4.choice.goal.curate_capsule.label':
    'Curatera en kapsel',
  'onboarding.quizV4.choice.goal.curate_capsule.caption':
    'Färre plagg, fler outfits, med syfte.',
  'onboarding.quizV4.choice.goal.special_events.label':
    'Planera särskilda tillfällen',
  'onboarding.quizV4.choice.goal.special_events.caption':
    'Sätt rätt ton för bröllop, dejter och fester.',
  'onboarding.quizV4.choice.goal.professional_polish.label':
    'Professionell polish',
  'onboarding.quizV4.choice.goal.professional_polish.caption':
    'Se rätt ut på jobbet, varje möte.',
  'onboarding.quizV4.choice.goal.sustainability.label':
    'Shoppa mer hållbart',
  'onboarding.quizV4.choice.goal.sustainability.caption':
    'Bär det jag äger; fyll bara verkliga luckor.',
  'onboarding.quizV4.choice.goal.fun_experimenting.label':
    'Ha kul och experimentera',
  'onboarding.quizV4.choice.goal.fun_experimenting.caption':
    'Prova nya looker; gör det till lek att klä dig.',
  // Q cultural
  'onboarding.quizV4.q.cultural.prompt':
    'Något annat BURS bör veta?',
  'onboarding.quizV4.q.cultural.help':
    'Kulturella, religiösa eller tillgänglighetsbehov vi bör respektera. Valfritt.',
  'onboarding.quizV4.q.cultural.placeholder':
    't.ex. täcker alltid axlar, föredrar måttfulla snitt, inga höga klackar.',
  // Complete
  'onboarding.quizV4.complete.title': 'Din stilprofil är klar.',
  'onboarding.quizV4.complete.body':
    'BURS skräddarsyr nu outfits, planering och shopping efter ditt liv.',
  'onboarding.quizV4.complete.cta': 'Klar',
  // Photo tutorial
  'onboarding.photoTutorial.eyebrow': 'Så skannar du',
  'onboarding.photoTutorial.title': 'Ta ett bra plaggfoto',
  'onboarding.photoTutorial.intro':
    'En minut här sparar timmar senare. Några snabba regler och vi kör.',
  'onboarding.photoTutorial.good.title':
    'Plant, väl belyst, hela plagget',
  'onboarding.photoTutorial.good.bullets.0':
    'Ljust, jämnt ljus — dagsljus nära ett fönster fungerar bäst.',
  'onboarding.photoTutorial.good.bullets.1':
    'Slät bakgrund — lägg plagget på en säng, ett golv eller en vägg.',
  'onboarding.photoTutorial.good.bullets.2':
    'Hela plagget i bild — visa alla kanter och hörn.',
  'onboarding.photoTutorial.good.bullets.3':
    'Inga personer — håll händer, speglar och ansikten utanför bilden.',
  'onboarding.photoTutorial.bad.title':
    'Mörkt, rörigt eller beskuret',
  'onboarding.photoTutorial.bad.bullets.0':
    'Undvik hårda skuggor, sidoljus från fel håll eller mörka hörn.',
  'onboarding.photoTutorial.bad.bullets.1':
    'Hoppa över rörig mönstrad bakgrund — de förvirrar AI:n.',
  'onboarding.photoTutorial.bad.bullets.2':
    'Beskär inte bort ärmar, fållar eller detaljer.',
  'onboarding.photoTutorial.bad.bullets.3':
    'Fotografera inte plagget på en person eller skyltdocka.',
  'onboarding.photoTutorial.continue': 'Fortsätt',
  'onboarding.photoTutorial.skip': 'Hoppa över',

  // ─── Quiz (legacy 5-question shape, distinct from quizV4) ──────────────
  'quiz.questionCounter': 'Fråga {q} av {total}',
  'quiz.cta.back': 'Tillbaka',
  'quiz.cta.next': 'Nästa',
  'quiz.cta.finish': 'Slutför',
  'quiz.q1.title': 'Lite om dig',
  'quiz.q1.body': 'Hjälper oss skräddarsy passform och silhuett.',
  'quiz.q1.gender.label': 'Kön',
  'quiz.q1.gender.woman': 'Kvinna',
  'quiz.q1.gender.man': 'Man',
  'quiz.q1.gender.nonbinary': 'Icke-binär',
  'quiz.q1.gender.undisclosed': 'Vill inte uppge',
  'quiz.q1.height.label': 'Längd',
  'quiz.q1.height.cm': 'cm',
  'quiz.q1.height.decrease': 'Minska längd',
  'quiz.q1.height.increase': 'Öka längd',
  'quiz.q2.title': 'Hur fördelas din vecka?',
  'quiz.q2.body':
    'Dra en stapel för att sätta dess andel. Resten balanseras till 100 %.',
  'quiz.q2.label.work': 'Jobb',
  'quiz.q2.label.social': 'Socialt',
  'quiz.q2.label.active': 'Aktivt',
  'quiz.q2.label.home': 'Hemma',
  'quiz.q2.label.travel': 'Resa',
  'quiz.q2.total': 'Totalt',
  'quiz.q2.percentLabel': '{label} procent',
  'quiz.q2.action.increase': 'Öka',
  'quiz.q2.action.decrease': 'Minska',
  'quiz.q3.title': 'Var klär du dig?',
  'quiz.q3.body':
    'Hjälper väga ytterplagg, tyger och väderanpassade förslag.',
  'quiz.q3.climate.label': 'Klimat',
  'quiz.q3.climate.hot': 'Varmt',
  'quiz.q3.climate.warm': 'Milt',
  'quiz.q3.climate.mild': 'Tempererat',
  'quiz.q3.climate.cold': 'Kallt',
  'quiz.q3.climate.variable': 'Varierande',
  'quiz.q3.city.label': 'Stad',
  'quiz.q3.city.placeholder': 'Din stad',
  'quiz.q4.title': 'Välj dina stilord',
  'quiz.q4.eyebrow.range': 'Välj {min}–{max}',
  'quiz.q4.eyebrow.count': '{count} valda',
  'quiz.q4.archetype.minimal': 'Minimalistisk',
  'quiz.q4.archetype.classic': 'Klassisk',
  'quiz.q4.archetype.romantic': 'Romantisk',
  'quiz.q4.archetype.street': 'Street',
  'quiz.q4.archetype.bohemian': 'Bohemisk',
  'quiz.q4.archetype.preppy': 'Preppy',
  'quiz.q4.archetype.elegant': 'Elegant',
  'quiz.q4.archetype.edgy': 'Edgy',
  'quiz.q4.archetype.coastal': 'Kustig',
  'quiz.q4.archetype.sporty': 'Sportig',
  'quiz.q4.archetype.avantgarde': 'Avantgarde',
  'quiz.q4.archetype.workwear': 'Workwear',
  'quiz.q5.title': 'Vad ska BURS göra för dig?',
  'quiz.q5.goal.fasterDressing.label': 'Klä mig snabbare',
  'quiz.q5.goal.fasterDressing.caption':
    'Ett tydligt val varje morgon, ingen beslutströtthet.',
  'quiz.q5.goal.discoverCombos.label': 'Upptäck nya kombinationer',
  'quiz.q5.goal.discoverCombos.caption':
    'Kombinationer du inte hade provat på egen hand.',
  'quiz.q5.goal.shopSmarter.label': 'Shoppa smartare',
  'quiz.q5.goal.shopSmarter.caption':
    'Fyll de verkliga luckorna i din garderob — inte de inbillade.',
  'quiz.q5.goal.capsuleWardrobe.label': 'Bygg en kapselgarderob',
  'quiz.q5.goal.capsuleWardrobe.caption':
    'Färre plagg, fler outfits, med syfte.',

  // ─── Studio ─────────────────────────────────────────────────────────────
  'studio.eyebrow': 'Din studio',
  'studio.title': 'Välj din presentation',
  'studio.body': 'Hur ska BURS visa dina plagg?',
  'studio.recommended': 'Rekommenderas',
  'studio.option.ghost.title': 'Spökmannekäng',
  'studio.option.ghost.caption': 'Professionell, osynlig kroppsform.',
  'studio.option.flat.title': 'Liggande',
  'studio.option.flat.caption': 'Ren fotografering på platt yta.',
  'studio.option.hanger.title': 'Galge',
  'studio.option.hanger.caption': 'Klassisk hängande visning.',
  'studio.continue': 'Fortsätt',

  // ─── Achievement ────────────────────────────────────────────────────────
  'achievement.eyebrow': 'Du är klar',
  'achievement.title': 'Din 3-dagars provperiod börjar nu',
  'achievement.body': 'Full tillgång till alla funktioner.',
  'achievement.feature.unlimited': 'Obegränsad outfitgenerering',
  'achievement.feature.chat': 'AI-stilchatt — alltid i sammanhang',
  'achievement.feature.studio': 'Spökmannekäng-rendering i studio',
  'achievement.cta': 'Börja styla',
  'achievement.restore.prompt': 'Redan prenumerant?',
  'achievement.restore.link': 'Återställ',
  'achievement.restore.label': 'Återställ tidigare prenumeration',

  // ─── Reveal ─────────────────────────────────────────────────────────────
  'reveal.eyebrow': 'Din första look',
  'reveal.title': 'Baserat på din stil',
  'reveal.tagline': 'Det här är bara början.',
  'reveal.cta': 'Till min garderob',
  'reveal.outfit.name': 'Första intrycket',
  'reveal.outfit.sub': 'Din första look',
  'reveal.loading': 'Skapar din första outfit…',

  // ─── Coach tour ─────────────────────────────────────────────────────────
  'coachTour.step.home':
    'Dagens outfit hamnar här — din dagliga plan börjar på det här kortet.',
  'coachTour.step.wardrobe':
    'Dina plagg lever här — varje plagg du skannar landar i den här ytan.',
  'coachTour.step.add':
    'Tryck på (+) för att lägga till ett plagg — den gula knappen är din snabbaste väg in.',
  'coachTour.step.outfits': 'Sparade looker bor här.',
  'coachTour.next': 'Nästa',
  'coachTour.skip': 'Hoppa över',
  'coachTour.done': 'Klart',
  'coachTour.progressTemplate': '{current} av {total}',
  'coachTour.skipConfirm.title': 'Hoppa över rundturen?',
  'coachTour.skipConfirm.body':
    'Du ser inte tipsen igen. Du kan alltid utforska — appen guidar dig när det behövs.',
  'coachTour.skipConfirm.cancel': 'Fortsätt',
  'coachTour.skipConfirm.confirm': 'Hoppa över',

  // ─── Profile ────────────────────────────────────────────────────────────
  'profile.shoppingList': 'Inköpslista',
  'profile.shoppingListEmpty': 'Inga sparade måsten ännu',
  'profile.styleDNA.archetype': 'Arketyp',
  'profile.styleDNA.formality': 'Formalitet',
  'profile.styleDNA.vibes': 'Vibes',
  'profile.styleDNA.empty':
    'Din stil-DNA byggs upp när du bär och betygsätter outfits.',
  'profile.stats.garmentsTemplate': '{count} plagg',
  'profile.stats.outfitsTemplate': '{count} outfits',
  'profile.stats.wearLogsTemplate': '{count} ggr',
  'profile.stats.garments': 'Plagg',
  'profile.stats.outfits': 'Outfits',
  'profile.stats.wears': 'Antal',
  'profile.refresh': 'Dra för att uppdatera',

  // ─── Paywall (full surface translation) ─────────────────────────────────
  'paywall.close': 'Stäng',
  'paywall.eyebrow': 'Lås upp BURS',
  'paywall.title': 'Din personliga stylist, alltid med dig',
  'paywall.subtitle':
    'Obegränsade outfits, AI-styling och spökmannekäng-renderingar.',
  'paywall.feature.unlimited.title': 'Obegränsad outfitgenerering',
  'paywall.feature.unlimited.caption':
    'Varje tillfälle, varje humör, varje dag.',
  'paywall.feature.chat.title': 'AI-stilchatt — alltid i sammanhang',
  'paywall.feature.chat.caption':
    'Känner till din garderob och din smak.',
  'paywall.feature.studio.title': 'Spökmannekäng-rendering i studio',
  'paywall.feature.studio.caption':
    'Redaktionella produktbilder på sekunder.',
  'paywall.feature.travel.title': 'Resekapsel + garderobsluckor',
  'paywall.feature.travel.caption':
    'Packa för varje resa; shoppa bara det som fyller en lucka.',
  'paywall.bullet.1': 'Obegränsad outfitgenerering',
  'paywall.bullet.2': 'AI-stilchatt i sammanhang',
  'paywall.bullet.3': 'Spökmannekäng-rendering i studio',
  'paywall.bullet.4': 'Resekapsel + garderobsluckor',
  'paywall.plan.monthly': 'Månadsvis',
  'paywall.plan.yearly': 'Årligen',
  'paywall.plan.savings': 'Spara {pct} %',
  'paywall.price.monthly': '119 SEK',
  'paywall.price.yearly': '899 SEK',
  'paywall.price.perMonth': 'per månad',
  'paywall.price.perYear': 'per år',
  'paywall.cta': 'Starta 3-dagars gratis provperiod',
  'paywall.subscribeCta': 'Prenumerera',
  'paywall.trial.monthly': '3 dagar gratis, sedan 119 SEK / månad',
  'paywall.trial.yearly':
    '3 dagar gratis, sedan 899 SEK / år, debiteras årligen',
  'paywall.monthly.title': 'Månadsvis',
  'paywall.monthly.priceLabel': '119 SEK / månad',
  'paywall.monthly.cta': 'Starta månadsvis',
  'paywall.yearly.title': 'Årligen',
  'paywall.yearly.priceLabel': '899 SEK / år',
  'paywall.yearly.cta': 'Starta årligen',
  'paywall.yearly.savingsBadge': 'Spara 35 %',
  'paywall.processing': 'Bearbetar…',
  'paywall.activated': 'Prenumeration aktiv',
  'paywall.activating':
    'Aktiverar din prenumeration… du ser den inom en minut.',
  'paywall.activated.title': 'Prenumeration aktiv',
  'paywall.activated.body': 'Välkommen till BURS Premium.',
  'paywall.activating.title': 'Aktiverar din prenumeration',
  'paywall.activating.body':
    'Det här tar oftast några sekunder. Om det inte syns inom en minut — tryck på Återställ köp.',
  'paywall.errorGeneric.title': 'Kunde inte slutföra köpet',
  'paywall.errorGeneric.body':
    'Försök igen eller återställ tidigare köp.',
  'paywall.error.generic':
    'Något gick fel. Vi kunde inte slutföra köpet — försök igen.',
  // paywall.error.cancelled is intentionally empty (silent dismiss UX)
  'paywall.error.cancelled': '',
  'paywall.restore': 'Återställ köp',
  'paywall.restorePurchases': 'Återställ köp',
  'paywall.restored': 'Köp återställt',
  'paywall.restoreNoPurchases.title': 'Inget köp att återställa',
  'paywall.restoreNoPurchases.body':
    'Vi hittade inga aktiva prenumerationer på det här Apple-ID:t.',
  'paywall.restore.label': 'Återställ tidigare prenumeration',
  'paywall.restore.alertTitle': 'Återställ köp',
  'paywall.restore.alertBody':
    'Inget tidigare prenumerationsavtal hittades. Om du tror att det är fel, kontakta supporten.',
  'paywall.restore.alertOk': 'OK',
  'paywall.terms': 'Villkor',
  'paywall.terms.label': 'Öppna användarvillkor',
  'paywall.privacy': 'Integritet',
  'paywall.privacy.label': 'Öppna integritetspolicy',
  'paywall.linkError.title': 'Kunde inte öppna länken',
  'paywall.termsLink': 'https://burs.me/terms',
  'paywall.privacyLink': 'https://burs.me/privacy',
  // Apple 3.1.2 disclosures — keep wording faithful to Apple guideline
  'paywall.disclosure.autoRenew':
    'Förnyas automatiskt om du inte avslutar minst 24 timmar före slutet av nuvarande period.',
  'paywall.disclosure.manage':
    'Hantera din prenumeration i dina Apple-ID-inställningar.',
  'paywall.disclosure.charge':
    'Betalningen dras från ditt Apple-ID-konto vid bekräftelse av köpet.',

  // ─── VisualSearch ───────────────────────────────────────────────────────
  'visualSearch.title': 'Sök med foto',
  'visualSearch.eyebrow': 'Visuell sökning',
  'visualSearch.takePhoto': 'Ta foto',
  'visualSearch.chooseFromLibrary': 'Välj från bibliotek',
  'visualSearch.searchCta': 'Sök den här looken',
  'visualSearch.searching': 'Letar efter liknande plagg…',
  'visualSearch.error':
    'Vi kunde inte köra den sökningen. Försök igen.',
  'visualSearch.wardrobeRow': 'Din garderob',
  'visualSearch.webRow': 'Hittade online',
  'visualSearch.wardrobeEmpty':
    'Inga garderobsmatchningar ännu — prova ett annat referensfoto.',
  'visualSearch.webEmpty': 'Inga online-matchningar ännu.',
  'visualSearch.webComingSoon': 'Onlineimport kommer snart',
  'visualSearch.takePhotoHint':
    'Öppnar kameran för att ta ett referensfoto',
  'visualSearch.chooseFromLibraryHint':
    'Öppnar galleriet för att välja ett referensfoto',
  'visualSearch.wardrobeMatchHint': 'Öppnar plaggdetaljen',
  'visualSearch.wardrobeMatchLoadingHint':
    'Laddar plagg — tryck för att öppna detaljen',
  'visualSearch.webMatchHint': 'Visar produktinfo online',
  'visualSearch.clearReferenceHint': 'Tar bort referensfotot',
  'visualSearch.clearReferenceLabel': 'Rensa referens',
  'visualSearch.imageTooLarge':
    'Bilden är för stor — prova ett mindre foto',
  'visualSearch.permission.cameraTitle': 'Behörighet behövs',
  'visualSearch.permission.cameraBody':
    'Kameraåtkomst krävs för att ta ett referensfoto.',
  'visualSearch.permission.galleryTitle': 'Behörighet behövs',
  'visualSearch.permission.galleryBody':
    'Åtkomst till fotobiblioteket krävs för att välja en referensbild.',
  'visualSearch.permission.openSettings': 'Öppna inställningar',
  'visualSearch.permission.cancel': 'Avbryt',
  'visualSearch.cameraUnavailableTitle': 'Kameran är otillgänglig',
  'visualSearch.cameraUnavailableBody':
    'Kunde inte ta ett foto. Försök igen.',
  'visualSearch.galleryUnavailableTitle': 'Galleriet är otillgängligt',
  'visualSearch.galleryUnavailableBody':
    'Kunde inte välja ett foto. Försök igen.',
  'visualSearch.webMatchOpenAction': 'Öppna',
  'visualSearch.cancel': 'Avbryt',
  'visualSearch.invalidWebUrl':
    'Den här länken är inte säker att öppna.',
  'visualSearch.webComingSoonInline':
    'Online-matchningar kommer snart',

  // ─── ImportFromLink ─────────────────────────────────────────────────────
  'importFromLink.eyebrow': 'Importera',
  'importFromLink.title': 'Klistra in en länk',
  'importFromLink.back': 'Tillbaka',
  'importFromLink.inputLabel': 'Produkt-URL:er',
  'importFromLink.inputHint':
    'En länk per rad · vi hämtar produktbild och detaljer',
  'importFromLink.placeholder':
    'https://www.exempel.se/produkt\nhttps://www.exempel.se/annan',
  'importFromLink.cta': 'Hitta plagg',
  'importFromLink.searching': 'Importerar {current} av {total}…',
  'importFromLink.maxLinks': 'Max {max} länkar per import',
  'importFromLink.resultsHeading': 'Importer',
  'importFromLink.statusWaiting': 'Väntar',
  'importFromLink.statusImporting': 'Importerar',
  'importFromLink.statusSuccess': 'Importerad',
  'importFromLink.statusFailed': 'Misslyckades',
  'importFromLink.openGarmentLabel':
    'Öppna importerat plagg — {title}',
  'importFromLink.openGarmentHint':
    'Öppnar det sparade plagget så att du kan finjustera detaljerna',
  'importFromLink.allDone':
    '{success} importerade · {failed} misslyckade',
  'importFromLink.error.invalidUrl':
    'Lägg till minst en giltig https://-länk.',
  'importFromLink.error.noResults':
    'Ingen av länkarna kunde importeras. Prova en annan källa.',
  'importFromLink.error.network':
    'Kunde inte nå importören. Kontrollera anslutningen och försök igen.',
  'importFromLink.cancelTitle': 'Avbryt import?',
  'importFromLink.cancelBody':
    'Aktuell omgång pågår fortfarande.',
  'importFromLink.cancelStay': 'Fortsätt importera',
  'importFromLink.cancelLeave': 'Avbryt',

  // ─── TravelCapsule ──────────────────────────────────────────────────────
  'travelCapsule.savedHeading': 'Sparade resor',
  'travelCapsule.savedEmpty': 'Inga sparade kapslar ännu',
  'travelCapsule.savedEmptyBody':
    'Planera din första resa nedan — dina sparade kapslar bor här.',
  'travelCapsule.savedTripDeletedTitle': 'Borttagen',
  'travelCapsule.savedTripDeleteFailed':
    'Kunde inte ta bort resan. Försök igen.',
  'travelCapsule.delete.confirmTitle': 'Ta bort den här resan?',
  'travelCapsule.delete.confirmBody':
    'Din kapsel för {destination} tas bort. Det går inte att ångra.',
  'travelCapsule.delete.confirmCancel': 'Behåll',
  'travelCapsule.delete.confirmConfirm': 'Ta bort',
  'travelCapsule.delete.aria': 'Ta bort sparad resa',
  'travelCapsule.openSavedHint': 'Öppnar den här sparade kapseln',
  'travelCapsule.savedTripItemsTemplate':
    '{items} plagg · {outfits} looker',
  'travelCapsule.generating': 'Bygger din kapsel…',
  'travelCapsule.generatingBody':
    'BURS väljer plagg som passar för resa — det kan ta upp till 30 sekunder.',
  'travelCapsule.generateFailed.title':
    'Kunde inte bygga en kapsel',
  'travelCapsule.generateFailed.body':
    'Något gick fel hos oss. Försök igen om en stund.',
  'travelCapsule.subscriptionRequired.title': 'Premiumfunktion',
  'travelCapsule.subscriptionRequired.body':
    'Resekapsel ingår i BURS Premium. Uppgradera för att fortsätta packa smart.',
  'travelCapsule.notEnoughGarmentsTitle':
    'Inte tillräckligt med plagg ännu',
  'travelCapsule.notEnoughGarmentsBody':
    'Lägg till minst 5 plagg i din garderob innan du bygger en kapsel.',
  'travelCapsule.pickerStep.eyebrow': 'Steg 1 av 3',
  'travelCapsule.pickerStep.title': 'Välj plaggen du behöver',
  'travelCapsule.pickerStep.intro':
    'Tryck på upp till 8 plagg du vill ha med på resan. Hoppa över om du vill att BURS väljer helt själv.',
  'travelCapsule.pickerStep.continueWithoutPicks':
    'Hoppa över · låt BURS välja',
  'travelCapsule.pickerStep.continueWithPicks':
    'Fortsätt med dessa',

  // ─── TravelMustHaves ───────────────────────────────────────────────────
  'travelMustHaves.heading': 'Dina måsten',
  'travelMustHaves.intro':
    'Markera varje plagg — tar med, ersätter eller funderar fortfarande. Ditt val.',
  'travelMustHaves.status.have': 'Jag har det',
  'travelMustHaves.status.buy': 'Jag köper',
  'travelMustHaves.status.unsure': 'Osäker',
  'travelMustHaves.status.aria':
    'Växla mellan har / köper / osäker',
  'travelMustHaves.continueCta': 'Fortsätt · packlistan',
  'travelMustHaves.empty.title': 'Inga måsten ännu',
  'travelMustHaves.empty.body':
    'Bygg en kapsel först för att se plaggen BURS valde åt dig.',
  'travelMustHaves.saveFailed':
    'Kunde inte spara dina ändringar. Försök igen.',
  'travelMustHaves.saveConflictTitle': 'Uppdaterad någon annanstans',
  'travelMustHaves.saveConflictBody':
    'Vi hämtade en färskare version av resan. Din senaste ändring sparades inte — granska den nya och försök igen vid behov.',
  'travelMustHaves.section.picks': 'Dina val',
  'travelMustHaves.section.gaps':
    'Vi märkte också luckor för den här resan',

  // ─── TravelPackingList ─────────────────────────────────────────────────
  'travelPackingList.eyebrowTemplate': '{destination} · {duration}',
  'travelPackingList.empty.title': 'Tom packlista',
  'travelPackingList.empty.body':
    'Inget här ännu — försök bygga om kapseln.',
  'travelPackingList.allPacked': 'Allt packat · redo att flyga',
  'travelPackingList.saveFailedTitle': 'Kunde inte spara',
  'travelPackingList.saveFailedBody':
    'Vi kunde inte spara dina packändringar. Dra för att uppdatera och försök igen.',
  'travelPackingList.saveConflictTitle': 'Sparkonflikt',
  'travelPackingList.saveConflictBody':
    'Din packlista uppdaterades någon annanstans. Försök igen.',
  'travelPackingList.itemsLeftTemplate': '{count} plagg kvar',
  'travelPackingList.itemsLeftOne': '1 plagg kvar',
  'travelPackingList.toggleAria': 'Markera som packat',
  'travelPackingList.shareCta': 'Dela packlista',
  'travelPackingList.shareSoon': 'Delning kommer snart.',
  'travelPackingList.daysTemplate.zero': 'Dagsresa',
  'travelPackingList.daysTemplate.one': '1 dag',
  'travelPackingList.daysTemplate.other': '{count} dagar',

  // ─── TravelGarmentPicker ───────────────────────────────────────────────
  'travelGarmentPicker.searchPlaceholder': 'Sök i din garderob',
  'travelGarmentPicker.filter.all': 'Alla',
  'travelGarmentPicker.filter.tops': 'Överdelar',
  'travelGarmentPicker.filter.bottoms': 'Underdelar',
  'travelGarmentPicker.filter.outerwear': 'Ytterplagg',
  'travelGarmentPicker.filter.shoes': 'Skor',
  'travelGarmentPicker.filter.accessories': 'Accessoarer',
  'travelGarmentPicker.selectedTemplate.one': '1 / {max} valda',
  'travelGarmentPicker.selectedTemplate.other':
    '{count} / {max} valda',
  'travelGarmentPicker.empty.title': 'Inga plagg ännu',
  'travelGarmentPicker.empty.body':
    'Lägg till plagg i din garderob innan du bygger en kapsel.',
  'travelGarmentPicker.empty.cta': 'Lägg till ett plagg',

  // ─── Home — Weather strip + Occasion picker + Recent outfits (M35) ────
  'home.weather.eyebrow': 'Idag',
  'home.weather.tomorrowTemplate': 'Imorgon {high}° / {low}° · {condition}',
  'home.occasion.eyebrow': 'Vad gäller dagen?',
  'home.occasion.casual': 'Vardag',
  'home.occasion.work': 'Jobb',
  'home.occasion.party': 'Fest',
  'home.occasion.workout': 'Träning',
  'home.occasion.dinner': 'Middag',
  'home.recent.eyebrow': 'Senaste outfits',
  'home.recent.empty': 'Sparade looks landar här.',
  'home.recent.savedFallback': 'Sparad',

  // ─── Calendar sync (M36) ──────────────────────────────────────────────
  'settings.calendar.section': 'Kalender',
  'settings.calendar.row.connect': 'Anslut Google Kalender',
  'settings.calendar.row.connect.caption':
    'Skarpare outfitval utifrån vad du har för dagen.',
  'settings.calendar.row.disconnect': 'Koppla bort Google Kalender',
  'settings.calendar.row.connected.caption':
    'Vi läser din dag för att styla smartare.',
  'settings.calendar.connected.title': 'Kalender ansluten',
  'settings.calendar.connected.body':
    'Vi tar med dina händelser i dagens förslag.',
  'settings.calendar.error.title': 'Kunde inte ansluta kalender',
  'settings.calendar.error.body': 'Försök igen om en stund.',
  'settings.calendar.disconnect.title': 'Koppla bort Google Kalender?',
  'settings.calendar.disconnect.body':
    'Vi slutar synkronisera dina händelser och tar bort de som redan sparats.',
  'settings.calendar.disconnect.confirm': 'Koppla bort',

  'weather.condition.clear': 'Klart',
  'weather.condition.cloudy': 'Molnigt',
  'weather.condition.fog': 'Dimma',
  'weather.condition.drizzle': 'Duggregn',
  'weather.condition.rain': 'Regn',
  'weather.condition.snow': 'Snö',
  'weather.condition.rain_showers': 'Regnskurar',
  'weather.condition.snow_showers': 'Snöbyar',
  'weather.condition.thunder': 'Åska',
  'weather.condition.unknown': '—',

  // Home — "Ask the stylist" affordance seed copy. The seed renders as the
  // visible suggestion text on the row before the user has any chat history.
  'home.askStylist.exampleSeed': 'Vad passar till mina linnebyxor?',
  'home.askStylist.tapHint': 'Tryck för att chatta — anpassat till dig',

  // Home — Smart day banner fallback strings. Used when `summarize_day`
  // returns null and we still want a coherent, localized banner.
  'home.smartDay.eyebrowTemplate': '{weekday} · {context}',
  'home.smartDay.fallback.eyebrow': '{weekday}',
  'home.smartDay.fallback.title': 'Välj det som känns rätt idag.',
  'home.smartDay.tapHint': 'Visa outfiten',
  'home.smartDay.openHint': 'Öppnar outfitens detaljer',

  // ─── Travel — G3 (multi-select Occasions + per-day outfits) ─────────────
  'travel.occasions.title': 'Tillfällen',
  'travel.occasions.work': 'Jobb',
  'travel.occasions.dinner': 'Middag',
  'travel.occasions.beach': 'Strand',
  'travel.occasions.hiking': 'Vandring',
  'travel.occasions.nightlife': 'Nattliv',
  'travel.occasions.wedding': 'Bröllop',
  'travel.occasions.sightseeing': 'Sightseeing',
  'travel.occasions.airport': 'Flygplats',
  'travel.occasions.active': 'Aktivt',
  'travel.outfits.tab': 'Outfits',
  'travel.outfits.dayLabel': 'Dag {day}',
  'travel.savedCapsules.empty': 'Skapa din första resa så hamnar den här.',
  'travelPackingList.tabPacking': 'Packlista',

  // ─── G1 — Chat history sheet, mode toggle, outfit suggestion card ────────
  'chat.history.title': 'Tidigare samtal',
  'chat.history.eyebrow': 'Historik',
  'chat.history.empty': 'Inga tidigare samtal ännu',
  'chat.history.previewEmpty': 'Inga meddelanden ännu',
  'chat.history.loading': 'Laddar…',
  'chat.history.openLabel': 'Öppna samtalshistorik',
  'chat.history.close': 'Stäng historik',
  'chat.history.messageCount.template': '{n} meddelanden',
  'chat.outfitCard.try': 'Prova denna outfit',
  'chat.outfitCard.eyebrow': 'Förslag',
  'chat.outfitCard.name.suggestion': 'Dagens val',
  'chat.outfitCard.name.saved': 'Sparad outfit',
  'chat.outfitCard.loading': 'Laddar outfit…',
  'chat.modeToggle.style': 'Stil',
  'chat.modeToggle.shopping': 'Köp',

  // ─── G4 — Wardrobe Gaps "Find similar" CTA ──────────────────────────────
  'pickMustHaves.findSimilar': 'Hitta liknande',

  // ─── Style Me (G5) — adjust weather, occasion/formality parity, anchor, save ─
  'styleMe.weather.adjustTitle': 'Justera väder',
  'styleMe.weather.tempLabel': 'Temperatur',
  'styleMe.weather.conditionLabel': 'Förhållande',
  'styleMe.weather.condition.clear': 'Klart',
  'styleMe.weather.condition.cloudy': 'Molnigt',
  'styleMe.weather.condition.rain': 'Regn',
  'styleMe.weather.condition.snow': 'Snö',
  'styleMe.weather.adjust.cta': 'Justera',
  'styleMe.weather.adjust.done': 'Klar',
  'styleMe.weather.adjust.reset': 'Återställ till live',
  'styleMe.weather.fallbackLine': '— · aktuellt väder',
  'styleMe.occasion.casual': 'Vardag',
  'styleMe.occasion.work': 'Jobb',
  'styleMe.occasion.evening': 'Kväll',
  'styleMe.occasion.date': 'Date',
  'styleMe.occasion.workout': 'Träning',
  'styleMe.occasion.travel': 'Resa',
  'styleMe.occasion.custom': 'Egen…',
  'styleMe.occasion.customPlaceholder': 'Skriv ett tillfälle',
  'styleMe.occasion.casual.sub': 'Ärenden, helger',
  'styleMe.occasion.work.sub': 'Kontor, möten',
  'styleMe.occasion.evening.sub': 'Sent ute',
  'styleMe.occasion.date.sub': 'Lite genomtänkt',
  'styleMe.occasion.workout.sub': 'Rörlighet',
  'styleMe.occasion.travel.sub': 'Lätt, lagervis',
  'styleMe.formality.formalOffice': 'Formellt kontor',
  'styleMe.formality.businessCasual': 'Business casual',
  'styleMe.formality.relaxedOffice': 'Avslappnat kontor',
  'styleMe.formality.baseline': 'Bas',
  'styleMe.anchor.title': 'Ankra ett plagg',
  'styleMe.anchor.cta': 'Välj',
  'styleMe.anchor.empty': 'Inget plagg ankrat',
  'styleMe.anchor.clear': 'Rensa',
  'styleMe.anchor.sheetTitle': 'Välj ett ankarplagg',
  'styleMe.anchor.sheetClose': 'Stäng',
  'styleMe.saved.badge': 'Sparad ✓',
  'styleMe.saved.openDetail': 'Öppna detaljer',
  'styleMe.saved.error.title': 'Kunde inte spara',
  'styleMe.preview.badge': 'Förhandsgranskning',
};
