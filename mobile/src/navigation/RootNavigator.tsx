// Root native-stack — every route the app can reach. Splash gates the user into
// Auth → Onboarding → Paywall → MainTabs as the acquisition funnel; everything
// else is reachable from inside MainTabs (Home / Wardrobe / Plan / Insights).
//
// Each "real" screen has a dedicated component file under ../screens; only a
// small handful (PublicProfile, BillingSuccess, BillingCancel, NotFound) still
// resolve to PlaceholderScreen because the experiences haven't shipped yet.
//
// Key wiring details:
//   • `linking` (M12) routes the password-recovery deep link
//     `burs://reset-password#access_token=...` into ResetPasswordScreen. The
//     hash fragment is parsed by App.tsx's useRecoveryDeepLink (it calls
//     supabase.auth.setSession before this navigator routes). Without the
//     fragment-stripping `getStateFromPath` override the default parser would
//     never match the configured `reset-password` route.
//   • Google OAuth completes by hitting `burs://auth/callback?code=...`.
//     RootNavigator listens via Linking and calls supabase.auth.exchangeCodeForSession;
//     the auth listener in AuthContext + SplashScreen completes the flow.

import React, { useEffect, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  getStateFromPath as defaultGetStateFromPath,
  type LinkingOptions,
} from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { exchangeCalendarCode, triggerGoogleSync } from '../hooks/useCalendarSync';
import { t as tr } from '../lib/i18n';

// Acquisition flow
import { SplashScreen as SplashRouteScreen } from '../screens/SplashScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PaywallScreen } from '../screens/PaywallScreen';

// Tabs shell
import { MainTabsScreen } from '../screens/MainTabsScreen';

// AddPiece flow
import { AddPieceStep1 } from '../screens/AddPieceStep1';
import { AddPieceStep2 } from '../screens/AddPieceStep2';
import { AddPieceStep3 } from '../screens/AddPieceStep3';
import { LiveScanScreen } from '../screens/LiveScanScreen';
import { VisualSearchScreen } from '../screens/VisualSearchScreen';
import { ImportFromLinkScreen } from '../screens/ImportFromLinkScreen';

// Wardrobe / outfit / sharing
import { OutfitsScreen } from '../screens/OutfitsScreen';
import { OutfitDetailScreen } from '../screens/OutfitDetailScreen';
import { OutfitGenerateScreen } from '../screens/OutfitGenerateScreen';
import { OutfitPoolScreen } from '../screens/OutfitPoolScreen';
import { PhotoFeedbackScreen } from '../screens/PhotoFeedbackScreen';
import { GarmentDetailScreen } from '../screens/GarmentDetailScreen';
import { EditGarmentScreen } from '../screens/EditGarmentScreen';
import { WardrobeGapsScreen } from '../screens/WardrobeGapsScreen';
import { PickMustHavesScreen } from '../screens/PickMustHavesScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { FiltersScreen } from '../screens/FiltersScreen';
import { UsedGarmentsScreen } from '../screens/UsedGarmentsScreen';
import { UnusedOutfitsScreen } from '../screens/UnusedOutfitsScreen';
import { UnusedGarmentsScreen } from '../screens/UnusedGarmentsScreen';

// Stylist / mood / occasion
import { StyleChatScreen } from '../screens/StyleChatScreen';
import { StyleMeScreen } from '../screens/StyleMeScreen';
import { MoodOutfitScreen } from '../screens/MoodOutfitScreen';
import { MoodFlowScreen } from '../screens/MoodFlowScreen';

// Travel capsule
import { TravelCapsuleScreen } from '../screens/TravelCapsuleScreen';
import { TravelMustHavesScreen } from '../screens/TravelMustHavesScreen';
import { TravelPackingListScreen } from '../screens/TravelPackingListScreen';
import { TravelOutfitsScreen } from '../screens/TravelOutfitsScreen';

// Calendar / laundry
import { MonthCalendarScreen } from '../screens/MonthCalendarScreen';
import { LaundryScreen } from '../screens/LaundryScreen';

// Settings / profile / extras
import { SettingsScreen } from '../screens/SettingsScreen';
import { SettingsAppearanceScreen } from '../screens/SettingsAppearanceScreen';
import { SettingsStyleScreen } from '../screens/SettingsStyleScreen';
import { SettingsNotificationsScreen } from '../screens/SettingsNotificationsScreen';
import { SettingsAccountScreen } from '../screens/SettingsAccountScreen';
import { SettingsProfileEditScreen } from '../screens/SettingsProfileEditScreen';
import { SettingsPrivacyScreen } from '../screens/SettingsPrivacyScreen';
// M40 — native Privacy Policy + Terms screens. Pre-M40 the SettingsPrivacy
// row + PaywallScreen footer linked to https://burs.me/privacy and /terms;
// the launch decision cuts the public marketing site, so these screens host
// the canonical legal copy in-app to satisfy App Store guideline 5.1.1 + 3.1.2.
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { TermsScreen } from '../screens/TermsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
// M12 — real ResetPasswordScreen mounted (was a placeholder pre-M12). The
// recovery email link `burs://reset-password` deep-links here via the
// `linking` config exported below; the screen reads the now-hydrated
// session and writes the new password through useResetPassword.confirmReset.
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';

import { PlaceholderScreen } from '../screens/PlaceholderScreen';

import type { TabId } from '../components/BottomNav';
import type { AnalysisResult } from '../hooks/useAnalyzeGarment';
import type { AddGarmentSource } from '../hooks/useAddGarment';
import type { WardrobeAgingBucketId } from '../hooks/useWardrobeAging';
import type { WardrobeGap } from '../hooks/useWardrobeGaps';
import type { StyleChatMode } from '../hooks/useStyleChat';

export type TabName = TabId;

/**
 * Staged-photo shape for the AddPiece flow. Threaded from Step 1 through Step 2 and Step 3
 * via route params so the user's actual count + hue selections drive the downstream rows.
 *
 * `uri` is required once W5 wires real upload — Step 1 only stages photos that have a
 * camera/gallery URI. `hue` is retained so the piece-selector strip in Step 3 has a
 * stable fallback colour while the real image loads.
 */
export type AddPiecePhoto = { id: number; hue: number; uri: string };

/**
 * Wardrobe filter selection passed back from FiltersScreen via the route's `onApply` callback.
 * Mirrors the local FiltersScreen state shape (multi-select for Category/Color/Material/Fit/
 * Season; single-select for Sort). When the wardrobe filtering hook lands, this becomes the
 * input shape for the server-side query (or the in-memory client-side filter).
 */
export type WardrobeFilters = {
  categories: string[];
  colors: string[];
  materials: string[];
  fits: string[];
  seasons: string[];
  sort: string;
};

export type RootStackParamList = {
  // Acquisition flow — Splash is the initial route, gates auth + onboarding.
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  Paywall: undefined;

  MainTabs: { initialTab?: TabId } | undefined;

  // Add piece flow — Step 1 stages photos, Step 2 uploads + analyzes, Step 3 reviews +
  // saves. Photo URIs thread forward; storagePath + analysis come back from Step 2 →
  // Step 3 once the upload + AI round-trip lands. `source` is plumbed end-to-end so the
  // render-queue job is tagged with where the user actually came in (gallery/camera-tile
  // → 'add_photo'; LiveScan → 'live_scan').
  AddPieceStep1: undefined;
  // `batch` (M-batch wave) wires the multi-photo path: when present, Step 2
  // and Step 3 read the analyze + upload result from the batchPipeline module
  // rather than running them inline, and Step 3 bounces back into Step 2 with
  // index+1 after Save until the batch is done. Single-photo paths (LiveScan,
  // 1-photo Step 1) leave `batch` undefined and run the original inline flow.
  AddPieceStep2: {
    photoUri: string;
    allUris: string[];
    source: AddGarmentSource;
    batch?: { batchId: string; index: number; total: number };
  };
  // `storagePath` is nullable so Step 2 can forward the user to Step 3 before the
  // background upload settles (parallel analyze + upload). When null, Step 3 awaits
  // the in-flight upload via `uploadId` against the pendingUpload module before
  // calling useAddGarment. In the batch path, `storagePath` is non-null (the
  // pipeline ensures the upload has landed before marking the item ready) and
  // `uploadId` is omitted.
  AddPieceStep3: {
    storagePath: string | null;
    uploadId?: string;
    photoUri: string;
    analysis: AnalysisResult;
    source: AddGarmentSource;
    batch?: { batchId: string; index: number; total: number };
  };
  LiveScan: undefined;
  // M19 — Visual Search reachable from AddPieceStep1's third entry pill.
  // Self-contained surface (capture/pick reference → matches → tap a
  // wardrobe match → GarmentDetail; tap an online match → "import coming
  // soon" alert routed to M20).
  VisualSearch: undefined;
  // M20 — Import garments from product URLs. Reachable from
  // AddPieceStep1's fourth entry pill. Codex round 1 P3.4: route surface
  // kept minimal (`undefined`) since `initialUrl` is dead today. When
  // the iOS Share Extension wave lands, expand back to
  // `{ initialUrl?: string } | undefined` and the screen already reads
  // the param defensively.
  ImportFromLink: undefined;

  // Outfit / garment / sharing
  Outfits: undefined;
  // Q-B — `openPlanner` triggers the date-picker sheet to mount open on
  // first render (used by the OutfitGenerate "Plan for a date" flow);
  // `preselectDate` pre-selects a YYYY-MM-DD inside the sheet (used when
  // the user came from PlanScreen with a date already chosen). Both
  // optional and ignored on the regular outfit-detail navigation path.
  OutfitDetail: {
    id?: string;
    openPlanner?: boolean;
    preselectDate?: string;
  } | undefined;
  // Outfit-generation flow (loading → result). garmentId optional for "Wear today" /
  // "Restyle from this piece" entry points that anchor on a specific item.
  // seedGarmentIds (M17 Codex P1.4) optional for variation/clone entry
  // points that need to thread N-1 source garments — the screen feeds the
  // entire seed into `prefer_garment_ids` so the engine builds in-style
  // alternatives, not just an anchor-around-one-piece. Earlier code threaded
  // only `draft.items[0].garment_id` and lost N-1 of the source pieces.
  // Q-B — `initialDate` (YYYY-MM-DD) carries forward the date the user
  // selected on PlanScreen when they tapped "Create Outfit"; the result
  // page threads it into `OutfitDetail.preselectDate` when the user taps
  // "Plan for a date" so the sheet opens on the right date.
  OutfitGenerate: {
    garmentId?: string;
    seedGarmentIds?: string[];
    initialDate?: string;
  } | undefined;
  // M16 — outfit pool. anchorGarmentId / occasion mirror the single-outfit
  // generator's params (so a Restyle-from-piece tap can fan out to a pool of
  // 5–10 candidates). `count` defaults to 5 in the screen when omitted.
  OutfitPool: { anchorGarmentId?: string; occasion?: string; count?: number } | undefined;
  // M18 — photo feedback / selfie comparison. Reads `outfitId` and routes
  // the user through camera permission → capture → confirm → upload +
  // analyze → feedback card. Required param: the outfit being compared
  // against. Entered from OutfitDetail or PlanScreen's planned-outfit row.
  PhotoFeedback: { outfitId: string };
  EditGarment: { id: string };
  GarmentDetail: { id: string };
  PublicProfile: { handle?: string } | undefined;

  // Calendar + laundry
  MonthCalendar: undefined;
  Laundry: undefined;

  // Stylist / mood / occasion
  // G1 — accept seed nav params from Style Me's Restyle CTA and Wardrobe
  // Gaps' "Find similar" CTA. All optional so existing entry points (Home
  // tile, Smart day banner, etc.) keep navigating with `undefined`.
  //   • mode — pre-select 'style' or 'shopping' before any user input.
  //   • anchorGarmentIds — seed StyleChatScreen's anchored garment row;
  //     today only the first id binds (the screen anchors a single piece),
  //     but the array shape preserves a future N-anchor expansion without a
  //     param breaking change.
  //   • gapContext — Wardrobe Gaps handoff (G4); flips mode to 'shopping'
  //     and prefills the composer with `item_name`.
  //   • sourceOutfitId — provenance hint for restyle flows; not consumed
  //     by the screen yet but part of the contract for telemetry parity
  //     with web's restyle path.
  StyleChat:
    | {
        mode?: StyleChatMode;
        anchorGarmentIds?: string[];
        gapContext?: { category: string; item_name: string };
        sourceOutfitId?: string;
      }
    | undefined;
  StyleMe: undefined;
  MoodOutfit: undefined;
  // moodId / time flow through from MoodOutfitScreen so MoodFlow renders the user's
  // actual selections instead of a hardcoded placeholder. Both optional so direct nav
  // (e.g. from a future deep link) still lands on the screen with sane defaults.
  MoodFlow: { moodId?: string; time?: string } | undefined;

  // Travel capsule wizard. M28 wires real persistence — the wizard now
  // generates a saved capsule row before the user lands on either the
  // must-haves or packing list step. `capsuleId` is the row id and is
  // required once Step 1 has run; the legacy `selectedIds` carries the
  // initial must-have selection from the previous screen for the
  // generation hook to seed `result.must_haves`.
  //
  // Optional `capsuleId` on TravelMustHaves / TravelPackingList lets a
  // direct entry point (e.g. tapping a saved trip on the wizard screen)
  // skip the generation step. The screens guard against undefined and
  // route back to TravelCapsule when no id is in scope.
  TravelCapsule: undefined;
  TravelMustHaves: { capsuleId?: string } | undefined;
  TravelPackingList: { capsuleId?: string; selectedIds?: string[] } | undefined;
  // G3 sub-issue 6 — per-day outfits view, mirrors web's TravelResultsView
  // Outfits tab. Reachable from TravelPackingListScreen via the header
  // tab toggle.
  TravelOutfits: { capsuleId: string };

  // Discover / lists
  WardrobeGaps: undefined;
  // M24 — Pick must-haves follow-up. `gaps` carries the analysis result
  // forward from WardrobeGapsScreen so the picker doesn't have to re-run
  // (rate-limited) analysis. Empty `gaps: []` is the explicit signal for
  // the "opened from Profile shopping list row" entry — the screen
  // renders an empty state with a link back to gap analysis.
  PickMustHaves: { gaps: WardrobeGap[] };
  UsedGarments: undefined;
  UnusedOutfits: undefined;
  // M22 — Wardrobe Aging panel bucket-detail. `bucketId` is the
  // `WardrobeAgingBucketId` union exported from useWardrobeAging
  // ('aged' | 'unworn' | 'retire_candidates'). The screen still runs a
  // runtime guard (`isValidBucketId`) for stale deep links that pre-date
  // an enum change; the static type protects in-app navigation.
  UnusedGarments: { bucketId: WardrobeAgingBucketId };

  // Settings
  Settings: undefined;
  SettingsAppearance: undefined;
  SettingsStyle: undefined;
  SettingsNotifications: undefined;
  SettingsAccount: undefined;
  // N3.9 — display-name editor reachable from SettingsAccount's Full Name
  // row + the avatar Edit Photo link. Pre-N3.9 those rows popped a
  // "Coming Soon" alert, which Apple App Review flagged as a hard
  // blocker for the launch build.
  SettingsProfileEdit: undefined;
  SettingsPrivacy: undefined;
  // M40 — native legal screens reachable from SettingsPrivacy + PaywallScreen
  // + AuthScreen. No params; locale is read inside the screen via
  // useTranslation() and the body copy lives in lib/legalContent.
  PrivacyPolicy: undefined;
  Terms: undefined;

  // Profile / account / extras
  Profile: undefined;
  Notifications: undefined;
  ResetPassword: undefined;
  BillingSuccess: undefined;
  BillingCancel: undefined;
  NotFound: undefined;

  // Search / filters — FiltersScreen accepts an optional initial selection (so re-opening
  // the sheet preserves the previous picks) and an `onApply` callback fired with the chosen
  // filters before goBack. Callback-in-params is the standard React Navigation v6 pattern
  // for transient modal-style returns where deep-linking + persistence don't apply
  // (Wardrobe is a tab inside MainTabsScreen, not a stack route, so `nav.navigate('Wardrobe', ...)`
  // isn't an option). RN may log a non-serializable-params warning in dev; benign here
  // because Filters is never deep-linked and never restored from persisted nav state.
  Search: undefined;
  Filters: { initial?: WardrobeFilters; onApply?: (filters: WardrobeFilters) => void } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// M12 — deep-link routing. The recovery email URL is
// `burs://reset-password#access_token=...&refresh_token=...&type=recovery`.
// React Navigation matches the path and routes to ResetPassword; the hash
// fragment is parsed by the recovery handler in App.tsx (which calls
// supabase.auth.setSession before this screen reads the session). Other
// routes are unlinked: the app cold-starts to its initial route unless a
// recovery URL fired the launch.
//
// `getStateFromPath` override (Codex P1 round 1): RN's default parser
// strips `?` query strings but not `#` fragments, so the path
// `reset-password#access_token=...` would never match the configured
// `reset-password` route — the session would hydrate but the user would
// never navigate to ResetPasswordScreen. Strip the fragment first, then
// delegate to the default parser so route matching sees only the path.
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['burs://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
    },
  },
  getStateFromPath: (path, options) => {
    const fragmentIdx = path.indexOf('#');
    const cleanPath = fragmentIdx === -1 ? path : path.slice(0, fragmentIdx);
    return defaultGetStateFromPath(cleanPath, options);
  },
};

// Placeholder components MUST be created at module scope — not inside RootNavigator's render —
// so React Navigation sees stable function references across re-renders (e.g. after a theme
// change). Building them per-render would unmount/remount every screen in the stack, blowing
// away local screen state. Codex P1 #2 on PR #699.
const placeholder = (eyebrow: string, title: string, body?: string) => {
  const Screen = () => <PlaceholderScreen eyebrow={eyebrow} title={title} body={body} />;
  Screen.displayName = `Placeholder(${title})`;
  return Screen;
};

const Placeholders = {
  PublicProfile: placeholder('Public', 'Profile'),
  BillingSuccess: placeholder('Welcome', 'Premium activated'),
  BillingCancel: placeholder('Cancelled', 'Plan cancelled'),
  NotFound: placeholder('Off the rail', '404'),
} as const;

// Google OAuth completes by redirecting back to `burs://auth/callback?code=...`.
// supabase-js exchanges the code for a session, which then triggers the auth
// listener in AuthContext and SplashScreen-style routing into the app.
//
// Strict matching: only `burs://auth/callback` (any query/hash) triggers the
// exchange. Substring matching on `auth/callback` would let a foreign deep
// link like `burs://other/auth/callback/junk` reach `exchangeCodeForSession`,
// which on its own is harmless (PKCE binds the code to the AsyncStorage-stored
// `code_verifier`) but adds attack surface for no benefit. App Links / iOS
// universal links remain a future hardening step — the current scheme-only
// registration is not exclusive on either platform.
/** True for `me.burs.app://calendar/callback?code=…&state=…`. The mobile
 *  redirect URI uses the reverse-DNS form of the app's bundle ID
 *  (`me.burs.app`) per Google's installed-app OAuth requirement — see
 *  `useCalendarSync.CALENDAR_REDIRECT_URI` for the rationale. Codex P1
 *  on PR #772. Google redirects here after the user completes the
 *  consent screen. The handler below pulls `code` + `state` from the
 *  query and POSTs them back through `exchange_code` so the edge
 *  function stores tokens server-side. */
function isCalendarCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'me.burs.app:') return false;
    const host = parsed.hostname;
    const path = parsed.pathname;
    if (host === 'calendar' && (path === '/callback' || path === '/callback/')) return true;
    if (host === '' && (path === '/calendar/callback' || path === '/calendar/callback/')) return true;
    return false;
  } catch {
    return false;
  }
}

function isOAuthCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'burs:') return false;
    // RN's URL polyfill normalizes hostname/pathname differently for custom
    // schemes — accept both `burs://auth/callback` (host=auth, path=/callback)
    // and `burs:///auth/callback` (host='', path=/auth/callback) shapes.
    const host = parsed.hostname;
    const path = parsed.pathname;
    if (host === 'auth' && (path === '/callback' || path === '/callback/')) return true;
    if (host === '' && (path === '/auth/callback' || path === '/auth/callback/')) return true;
    return false;
  } catch {
    return false;
  }
}

async function handleOAuthDeepLink(
  url: string,
  lastExchangedCodeRef: React.MutableRefObject<string | null>,
): Promise<void> {
  if (!isOAuthCallbackUrl(url)) return;

  // PKCE flow only — `mobile/src/lib/supabase.ts` pins `flowType: 'pkce'`,
  // so the callback always arrives as `burs://auth/callback?code=<code>`.
  // We deliberately do NOT honour an implicit-flow fragment fallback
  // (`#access_token=…`): the `burs://` scheme is not exclusive on iOS or
  // Android, and any foreign app sharing it could intercept tokens or
  // feed us attacker-chosen ones. PKCE binds the code to the local
  // `code_verifier` supabase-js stashed in AsyncStorage — intercepting
  // the URL no longer yields a usable session. Codex P1 round 2 on PR #844.
  let code: string | null = null;
  try {
    code = new URL(url).searchParams.get('code');
  } catch {
    code = null;
  }
  if (!code) {
    console.warn('[RootNavigator] OAuth callback URL missing code:', url);
    return;
  }
  if (lastExchangedCodeRef.current === code) return;
  lastExchangedCodeRef.current = code;
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn('[RootNavigator] OAuth callback exchange failed:', error.message);
    }
  } catch (err) {
    console.warn('[RootNavigator] OAuth callback threw:', err);
  }
}

async function handleCalendarOAuthDeepLink(
  url: string,
  lastExchangedCodeRef: React.MutableRefObject<string | null>,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  if (!isCalendarCallbackUrl(url)) return;
  let code: string | null = null;
  let state: string | null = null;
  let oauthError: string | null = null;
  try {
    const parsed = new URL(url);
    code = parsed.searchParams.get('code');
    state = parsed.searchParams.get('state');
    oauthError = parsed.searchParams.get('error');
  } catch {
    code = null;
    state = null;
  }
  if (oauthError) {
    Alert.alert(tr('settings.calendar.error.title'), tr('settings.calendar.error.body'));
    return;
  }
  if (!code || !state) {
    console.warn('[RootNavigator] Calendar callback missing code/state:', url);
    return;
  }
  // Same per-launch dedupe pattern the OAuth login handler uses — iOS fires
  // both `getInitialURL` and `'url'` for the same launch URL, so we'd hit
  // `exchange_code` twice with the same single-use CSRF token (the second
  // call 4xxs and shows a misleading error to the user).
  if (lastExchangedCodeRef.current === code) return;
  lastExchangedCodeRef.current = code;
  // Resolve the auth user from the JWT bound to the Supabase session;
  // `exchangeCalendarCode` needs it to look up the PKCE verifier the
  // Connect path stored in AsyncStorage.
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    Alert.alert(tr('settings.calendar.error.title'), tr('settings.calendar.error.body'));
    return;
  }
  const result = await exchangeCalendarCode(code, state, userId);
  if (!result.ok) {
    Alert.alert(
      tr('settings.calendar.error.title'),
      result.error ?? tr('settings.calendar.error.body'),
    );
    return;
  }
  // Refresh connection state so the Settings row + Home banner flip to
  // "Connected" without waiting for the user to pull-to-refresh.
  await queryClient.invalidateQueries({ queryKey: ['calendar-connection'] });
  // Kick off the first sync so the user immediately sees their events
  // back in the app instead of waiting for the cron-scheduled background
  // sync. Failures here are non-fatal — connection is established, events
  // will land on the next sync cycle.
  try {
    await triggerGoogleSync();
    await queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
  } catch {
    // Silent — connection is the load-bearing state, sync can retry.
  }
  Alert.alert(tr('settings.calendar.connected.title'), tr('settings.calendar.connected.body'));
}

export function RootNavigator() {
  const lastExchangedCodeRef = useRef<string | null>(null);
  const lastCalendarCodeRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    const onUrl = ({ url }: { url: string }) => {
      if (cancelled) return;
      void handleOAuthDeepLink(url, lastExchangedCodeRef);
      void handleCalendarOAuthDeepLink(url, lastCalendarCodeRef, queryClient);
    };
    const subscription = Linking.addEventListener('url', onUrl);
    // Cold-start: app opened FROM a deep link — pull the URL ourselves.
    void Linking.getInitialURL().then((url) => {
      if (cancelled || !url) return;
      void handleOAuthDeepLink(url, lastExchangedCodeRef);
      void handleCalendarOAuthDeepLink(url, lastCalendarCodeRef, queryClient);
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [queryClient]);

  return (
    <Stack.Navigator
      // Splash is the production entry. In dev builds, drop straight to MainTabs
      // so the engineer-loop doesn't sit through a 1.5s splash on every reload.
      // Override at runtime by pushing 'Splash' explicitly.
      initialRouteName={__DEV__ ? 'MainTabs' : 'Splash'}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      {/* Acquisition flow — Splash gates onto Auth/Onboarding/MainTabs.
          Auth and Onboarding fade-in to feel less like a "page push" since
          they're the user's first impression of the app. Paywall presents
          modal-style (slide from bottom) — it can mount on top of any screen. */}
      <Stack.Screen
        name="Splash"
        component={SplashRouteScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="Auth"
        component={AuthScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />

      <Stack.Screen name="MainTabs" component={MainTabsScreen} />

      {/* Add piece flow */}
      <Stack.Screen name="AddPieceStep1" component={AddPieceStep1} />
      <Stack.Screen name="AddPieceStep2" component={AddPieceStep2} />
      <Stack.Screen name="AddPieceStep3" component={AddPieceStep3} />
      <Stack.Screen name="LiveScan" component={LiveScanScreen} />
      <Stack.Screen name="VisualSearch" component={VisualSearchScreen} />
      <Stack.Screen name="ImportFromLink" component={ImportFromLinkScreen} />

      {/* Outfit / garment / sharing */}
      <Stack.Screen name="Outfits" component={OutfitsScreen} />
      <Stack.Screen name="OutfitDetail" component={OutfitDetailScreen} />
      <Stack.Screen name="OutfitGenerate" component={OutfitGenerateScreen} />
      <Stack.Screen name="OutfitPool" component={OutfitPoolScreen} />
      <Stack.Screen name="PhotoFeedback" component={PhotoFeedbackScreen} />
      <Stack.Screen name="EditGarment" component={EditGarmentScreen} />
      <Stack.Screen name="GarmentDetail" component={GarmentDetailScreen} />
      <Stack.Screen name="PublicProfile" component={Placeholders.PublicProfile} />

      {/* Calendar + laundry */}
      <Stack.Screen name="MonthCalendar" component={MonthCalendarScreen} />
      <Stack.Screen name="Laundry" component={LaundryScreen} />

      {/* Stylist / mood / occasion */}
      <Stack.Screen name="StyleChat" component={StyleChatScreen} />
      <Stack.Screen name="StyleMe" component={StyleMeScreen} />
      <Stack.Screen name="MoodOutfit" component={MoodOutfitScreen} />
      <Stack.Screen name="MoodFlow" component={MoodFlowScreen} />

      {/* Travel capsule */}
      <Stack.Screen name="TravelCapsule" component={TravelCapsuleScreen} />
      <Stack.Screen name="TravelMustHaves" component={TravelMustHavesScreen} />
      <Stack.Screen name="TravelPackingList" component={TravelPackingListScreen} />
      <Stack.Screen name="TravelOutfits" component={TravelOutfitsScreen} />

      {/* Discover / lists */}
      <Stack.Screen name="WardrobeGaps" component={WardrobeGapsScreen} />
      <Stack.Screen name="PickMustHaves" component={PickMustHavesScreen} />
      <Stack.Screen name="UsedGarments" component={UsedGarmentsScreen} />
      <Stack.Screen name="UnusedOutfits" component={UnusedOutfitsScreen} />
      <Stack.Screen name="UnusedGarments" component={UnusedGarmentsScreen} />

      {/* Settings */}
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SettingsAppearance" component={SettingsAppearanceScreen} />
      <Stack.Screen name="SettingsStyle" component={SettingsStyleScreen} />
      <Stack.Screen name="SettingsNotifications" component={SettingsNotificationsScreen} />
      <Stack.Screen name="SettingsAccount" component={SettingsAccountScreen} />
      <Stack.Screen name="SettingsProfileEdit" component={SettingsProfileEditScreen} />
      <Stack.Screen name="SettingsPrivacy" component={SettingsPrivacyScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />

      {/* Profile / account / extras */}
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="BillingSuccess" component={Placeholders.BillingSuccess} />
      <Stack.Screen name="BillingCancel" component={Placeholders.BillingCancel} />
      <Stack.Screen name="NotFound" component={Placeholders.NotFound} />

      {/* Search / filters */}
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Filters" component={FiltersScreen} />
    </Stack.Navigator>
  );
}
