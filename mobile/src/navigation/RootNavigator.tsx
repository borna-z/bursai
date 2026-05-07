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
import { Linking } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  getStateFromPath as defaultGetStateFromPath,
  type LinkingOptions,
} from '@react-navigation/native';

import { supabase } from '../lib/supabase';

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
import { ShareOutfitScreen } from '../screens/ShareOutfitScreen';
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

// Calendar / laundry
import { MonthCalendarScreen } from '../screens/MonthCalendarScreen';
import { LaundryScreen } from '../screens/LaundryScreen';

// Settings / profile / extras
import { SettingsScreen } from '../screens/SettingsScreen';
import { SettingsAppearanceScreen } from '../screens/SettingsAppearanceScreen';
import { SettingsStyleScreen } from '../screens/SettingsStyleScreen';
import { SettingsNotificationsScreen } from '../screens/SettingsNotificationsScreen';
import { SettingsAccountScreen } from '../screens/SettingsAccountScreen';
import { SettingsPrivacyScreen } from '../screens/SettingsPrivacyScreen';
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
  AddPieceStep2: { photoUri: string; allUris: string[]; source: AddGarmentSource };
  // `storagePath` is nullable so Step 2 can forward the user to Step 3 before the
  // background upload settles (parallel analyze + upload). When null, Step 3 awaits
  // the in-flight upload via `uploadId` against the pendingUpload module before
  // calling useAddGarment.
  AddPieceStep3: {
    storagePath: string | null;
    uploadId?: string;
    photoUri: string;
    analysis: AnalysisResult;
    source: AddGarmentSource;
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
  OutfitDetail: { id?: string } | undefined;
  // Outfit-generation flow (loading → result). garmentId optional for "Wear today" /
  // "Restyle from this piece" entry points that anchor on a specific item.
  // seedGarmentIds (M17 Codex P1.4) optional for variation/clone entry
  // points that need to thread N-1 source garments — the screen feeds the
  // entire seed into `prefer_garment_ids` so the engine builds in-style
  // alternatives, not just an anchor-around-one-piece. Earlier code threaded
  // only `draft.items[0].garment_id` and lost N-1 of the source pieces.
  OutfitGenerate: { garmentId?: string; seedGarmentIds?: string[] } | undefined;
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
  ShareOutfit: { id?: string } | undefined;
  PublicProfile: { handle?: string } | undefined;

  // Calendar + laundry
  MonthCalendar: undefined;
  Laundry: undefined;

  // Stylist / mood / occasion
  StyleChat: undefined;
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
  SettingsPrivacy: undefined;

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
  // supabase-auth-js's `exchangeCodeForSession` POSTs whatever string we pass
  // as the `auth_code` param, so it expects the raw code string — not the
  // full deep-link URL. Passing the URL would make every OAuth login fail
  // even after the URL pattern matched. Parse the `code` query param and
  // exchange that. Codex P1 round 9 on PR #738.
  let code: string | null = null;
  try {
    code = new URL(url).searchParams.get('code');
  } catch {
    code = null;
  }
  if (!code) {
    console.warn('[RootNavigator] OAuth callback URL missing `code` param:', url);
    return;
  }
  // Dedupe per-launch: on iOS both `getInitialURL` and the `'url'` event
  // fire for the same launch URL, which would have us call
  // `exchangeCodeForSession` twice with the same code. The second call
  // 4xxs (PKCE codes are single-use) and pollutes Sentry with noise. Track
  // the last-exchanged code in a ref and short-circuit on a match. Codex
  // P2 round on PR #738.
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

export function RootNavigator() {
  const lastExchangedCodeRef = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const onUrl = ({ url }: { url: string }) => {
      if (!cancelled) void handleOAuthDeepLink(url, lastExchangedCodeRef);
    };
    const subscription = Linking.addEventListener('url', onUrl);
    // Cold-start: app opened FROM a deep link — pull the URL ourselves.
    void Linking.getInitialURL().then((url) => {
      if (!cancelled && url) void handleOAuthDeepLink(url, lastExchangedCodeRef);
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

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
      <Stack.Screen name="ShareOutfit" component={ShareOutfitScreen} />
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
      <Stack.Screen name="SettingsPrivacy" component={SettingsPrivacyScreen} />

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
