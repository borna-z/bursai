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
};
