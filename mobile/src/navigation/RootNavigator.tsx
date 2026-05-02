// Root native-stack registers every route from the design handoff.
// MainTabs (containing Home/Wardrobe/Plan/Insights) is the initial screen.
// Every other route is currently a `PlaceholderScreen` — swap in real implementations as they ship.
//
// Build order tracked in mobile/CLAUDE.md.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabsScreen } from '../screens/MainTabsScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
// Acquisition flow (PR feat/mobile-onboarding-auth-paywall)
import { SplashScreen as SplashRouteScreen } from '../screens/SplashScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
// AddPiece flow + stylist screens (from origin/main, PR #706 — Wave 8.5 P82)
import { AddPieceStep1 } from '../screens/AddPieceStep1';
import { AddPieceStep2 } from '../screens/AddPieceStep2';
import { AddPieceStep3 } from '../screens/AddPieceStep3';
import { StyleChatScreen } from '../screens/StyleChatScreen';
import { StyleMeScreen } from '../screens/StyleMeScreen';
import { MoodOutfitScreen } from '../screens/MoodOutfitScreen';
import { MoodFlowScreen } from '../screens/MoodFlowScreen';
// Wardrobe detail screens (this PR — #707)
import { OutfitsScreen } from '../screens/OutfitsScreen';
import { OutfitDetailScreen } from '../screens/OutfitDetailScreen';
import { GarmentDetailScreen } from '../screens/GarmentDetailScreen';
import { EditGarmentScreen } from '../screens/EditGarmentScreen';
import { WardrobeGapsScreen } from '../screens/WardrobeGapsScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { FiltersScreen } from '../screens/FiltersScreen';
import { UsedGarmentsScreen } from '../screens/UsedGarmentsScreen';
import { UnusedOutfitsScreen } from '../screens/UnusedOutfitsScreen';
import type { TabId } from '../components/BottomNav';

export type TabName = TabId;

/**
 * Staged-photo shape for the AddPiece flow. Threaded from Step 1 through Step 2 and Step 3
 * via route params so the user's actual count + hue selections drive the downstream rows
 * (Codex P2 on PR #706 — earlier impl rendered fixed 5-item mocks regardless of choices).
 *
 * Plain serializable data so React Navigation can persist it through state restoration.
 */
export type AddPiecePhoto = { id: number; hue: number };

export type RootStackParamList = {
  // Acquisition flow — Splash is the initial route, gates auth + onboarding.
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  Paywall: undefined;

  MainTabs: { initialTab?: TabId } | undefined;

  // Add piece flow (3 steps) — photos thread through so each step renders the user's batch.
  AddPieceStep1: undefined;
  AddPieceStep2: { photos?: AddPiecePhoto[] } | undefined;
  AddPieceStep3: { photos?: AddPiecePhoto[] } | undefined;
  LiveScan: undefined;

  // Outfit / garment / sharing
  Outfits: undefined;
  OutfitDetail: { id?: string } | undefined;
  EditGarment: { id?: string } | undefined;
  GarmentDetail: { id?: string } | undefined;
  ShareOutfit: { id?: string } | undefined;
  PublicProfile: { handle?: string } | undefined;

  // Stylist / mood / occasion
  StyleChat: undefined;
  StyleMe: undefined;
  MoodOutfit: undefined;
  // moodId / time flow through from MoodOutfitScreen so MoodFlow renders the user's
  // actual selections instead of a hardcoded placeholder. Both optional so direct nav
  // (e.g. from a future deep link) still lands on the screen with sane defaults.
  MoodFlow: { moodId?: string; time?: string } | undefined;

  // Travel capsule wizard
  TravelCapsule: undefined;
  TravelMustHaves: undefined;
  TravelPackingList: undefined;

  // Discover / lists
  WardrobeGaps: undefined;
  UsedGarments: undefined;
  UnusedOutfits: undefined;

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

  // Search / filters
  Search: undefined;
  // FiltersScreen accepts an optional initial selection (so re-opening the sheet preserves the
  // previous picks) and an `onApply` callback fired with the chosen filters before goBack.
  // Callback-in-params is the standard React Navigation v6 pattern for transient modal-style
  // returns where deep-linking + persistence don't apply (Wardrobe isn't a stack route — it's a
  // tab inside MainTabsScreen — so `nav.navigate('Wardrobe', ...)` isn't an option). RN may log
  // a non-serializable-params warning in dev; benign here because Filters is never deep-linked
  // and never restored from persisted nav state. Codex P2 round 8.
  Filters: { initial?: WardrobeFilters; onApply?: (filters: WardrobeFilters) => void } | undefined;
};

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

const Stack = createNativeStackNavigator<RootStackParamList>();

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
  // Add piece flow — only LiveScan is still a placeholder; Step1/Step2/Step3 are real (PR #706).
  LiveScan: placeholder('Live scan', 'Scan a piece', 'Single-piece live capture mode.'),

  // Outfit / garment / sharing — Outfits, OutfitDetail, EditGarment, GarmentDetail are now
  // real screens (PR #707). ShareOutfit + PublicProfile remain placeholders.
  ShareOutfit: placeholder('Share', 'Share outfit'),
  PublicProfile: placeholder('Public', 'Profile'),

  // (StyleChat / StyleMe / MoodOutfit / MoodFlow now have real impls — see Stack.Screen list below.)

  // Travel capsule
  TravelCapsule: placeholder('Trip', 'Travel capsule'),
  TravelMustHaves: placeholder('Step 5 of 6', 'Pick must-haves'),
  TravelPackingList: placeholder('Step 6 of 6', 'Packing list'),

  // Discover / lists — all three are real screens now (PR #707).
  // (no placeholders remaining in this group)

  // Settings
  Settings: placeholder('Settings', 'Preferences'),
  SettingsAppearance: placeholder('Appearance', 'Theme & motion'),
  SettingsStyle: placeholder('Style', 'Your preferences'),
  SettingsNotifications: placeholder('Notifications', 'Reminders'),
  SettingsAccount: placeholder('Account', 'Sign-in & billing'),
  SettingsPrivacy: placeholder('Privacy', 'Data & sharing'),

  // Profile / account / extras
  Profile: placeholder('You', 'Profile'),
  Notifications: placeholder('Inbox', 'Notifications'),
  ResetPassword: placeholder('Account', 'Reset password'),
  BillingSuccess: placeholder('Welcome', 'Premium activated'),
  BillingCancel: placeholder('Cancelled', 'Plan cancelled'),
  NotFound: placeholder('Off the rail', '404'),

  // Search / filters — both are real screens now (PR #707).
  // (no placeholders remaining in this group)
} as const;

export function RootNavigator() {
  return (
    <Stack.Navigator
      // Splash is the production entry. In dev builds, drop straight to MainTabs
      // so the engineer-loop doesn't sit through a 1.5s splash on every reload.
      // (X-5 from review.) Override at runtime by pushing 'Splash' explicitly.
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

      {/* Add piece flow — real implementations (PR #706) */}
      <Stack.Screen name="AddPieceStep1" component={AddPieceStep1} />
      <Stack.Screen name="AddPieceStep2" component={AddPieceStep2} />
      <Stack.Screen name="AddPieceStep3" component={AddPieceStep3} />
      <Stack.Screen name="LiveScan" component={Placeholders.LiveScan} />

      {/* Outfit / garment / sharing — Outfits / OutfitDetail / EditGarment / GarmentDetail
          are real screens (PR #707); ShareOutfit + PublicProfile remain placeholders. */}
      <Stack.Screen name="Outfits" component={OutfitsScreen} />
      <Stack.Screen name="OutfitDetail" component={OutfitDetailScreen} />
      <Stack.Screen name="EditGarment" component={EditGarmentScreen} />
      <Stack.Screen name="GarmentDetail" component={GarmentDetailScreen} />
      <Stack.Screen name="ShareOutfit" component={Placeholders.ShareOutfit} />
      <Stack.Screen name="PublicProfile" component={Placeholders.PublicProfile} />

      {/* Stylist / mood / occasion — real implementations (PR #706) */}
      <Stack.Screen name="StyleChat" component={StyleChatScreen} />
      <Stack.Screen name="StyleMe" component={StyleMeScreen} />
      <Stack.Screen name="MoodOutfit" component={MoodOutfitScreen} />
      <Stack.Screen name="MoodFlow" component={MoodFlowScreen} />

      {/* Travel capsule */}
      <Stack.Screen name="TravelCapsule" component={Placeholders.TravelCapsule} />
      <Stack.Screen name="TravelMustHaves" component={Placeholders.TravelMustHaves} />
      <Stack.Screen name="TravelPackingList" component={Placeholders.TravelPackingList} />

      {/* Discover / lists — all three real (PR #707) */}
      <Stack.Screen name="WardrobeGaps" component={WardrobeGapsScreen} />
      <Stack.Screen name="UsedGarments" component={UsedGarmentsScreen} />
      <Stack.Screen name="UnusedOutfits" component={UnusedOutfitsScreen} />

      {/* Settings */}
      <Stack.Screen name="Settings" component={Placeholders.Settings} />
      <Stack.Screen name="SettingsAppearance" component={Placeholders.SettingsAppearance} />
      <Stack.Screen name="SettingsStyle" component={Placeholders.SettingsStyle} />
      <Stack.Screen name="SettingsNotifications" component={Placeholders.SettingsNotifications} />
      <Stack.Screen name="SettingsAccount" component={Placeholders.SettingsAccount} />
      <Stack.Screen name="SettingsPrivacy" component={Placeholders.SettingsPrivacy} />

      {/* Profile / account / extras */}
      <Stack.Screen name="Profile" component={Placeholders.Profile} />
      <Stack.Screen name="Notifications" component={Placeholders.Notifications} />
      <Stack.Screen name="ResetPassword" component={Placeholders.ResetPassword} />
      <Stack.Screen name="BillingSuccess" component={Placeholders.BillingSuccess} />
      <Stack.Screen name="BillingCancel" component={Placeholders.BillingCancel} />
      <Stack.Screen name="NotFound" component={Placeholders.NotFound} />

      {/* Search / filters — both real (PR #707) */}
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Filters" component={FiltersScreen} />
    </Stack.Navigator>
  );
}
