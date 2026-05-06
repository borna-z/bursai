// Root native-stack registers every route from the design handoff.
// MainTabs (containing Home/Wardrobe/Plan/Insights) is the initial screen.
// Every other route is currently a `PlaceholderScreen` — swap in real implementations as they ship.
//
// Build order tracked in mobile/CLAUDE.md.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AddPieceStep1 } from '../screens/AddPieceStep1';
import { AddPieceStep2 } from '../screens/AddPieceStep2';
import { AddPieceStep3 } from '../screens/AddPieceStep3';
import { GarmentDetailScreen } from '../screens/GarmentDetailScreen';
import { MainTabsScreen } from '../screens/MainTabsScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
// M11 — destructive flows live behind Settings → Account / Privacy & data,
// so SettingsScreen + SettingsAccountScreen + SettingsPrivacyScreen
// have to be reachable for App Store guideline 5.1.1(v) review. The
// other settings screens are mounted alongside since they're a unit.
import { SettingsScreen } from '../screens/SettingsScreen';
import { SettingsAccountScreen } from '../screens/SettingsAccountScreen';
import { SettingsAppearanceScreen } from '../screens/SettingsAppearanceScreen';
import { SettingsNotificationsScreen } from '../screens/SettingsNotificationsScreen';
import { SettingsPrivacyScreen } from '../screens/SettingsPrivacyScreen';
import { SettingsStyleScreen } from '../screens/SettingsStyleScreen';
import type { TabId } from '../components/BottomNav';
import type { MoodId } from '../components/MoodCard';
import type { AnalysisResult } from '../hooks/useAnalyzeGarment';
import type { AddGarmentSource } from '../hooks/useAddGarment';

export type TabName = TabId;

/**
 * Shape of a single staged photo in the AddPiece flow.
 * id = monotonic counter so two photos in the same ms don't collide;
 * hue is the HSL gradient seed for the placeholder card before upload.
 */
export type AddPiecePhoto = {
  id: number;
  hue: number;
  uri: string;
};

/** Wardrobe filter selection — passed both to and from the Filters sheet. */
export type WardrobeFilters = {
  categories: string[];
  colors: string[];
  materials: string[];
  fits: string[];
  seasons: string[];
  sort: string;
};

export type RootStackParamList = {
  MainTabs: { initialTab?: TabId } | undefined;

  // Auth + onboarding shell
  Auth: undefined;
  Onboarding: undefined;
  Paywall: undefined;

  // Add piece flow (3 steps)
  AddPieceStep1: undefined;
  AddPieceStep2: { photoUri: string; allUris: string[]; source: AddGarmentSource };
  AddPieceStep3: {
    storagePath: string | null;
    uploadId?: string;
    photoUri: string;
    analysis: AnalysisResult;
    source: AddGarmentSource;
  };
  LiveScan: undefined;

  // Outfit / garment / sharing
  Outfits: undefined;
  OutfitDetail: { id?: string } | undefined;
  OutfitGenerate: { garmentId?: string } | undefined;
  EditGarment: { id?: string } | undefined;
  GarmentDetail: { id?: string } | undefined;
  ShareOutfit: { id?: string } | undefined;
  PublicProfile: { handle?: string } | undefined;

  // Stylist / mood / occasion
  StyleChat: undefined;
  StyleMe: undefined;
  MoodOutfit: { moodId?: MoodId; time?: string } | undefined;
  MoodFlow: { moodId: MoodId; time: string };

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
  Filters: { initial?: WardrobeFilters; onApply?: (next: WardrobeFilters) => void } | undefined;
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
  // Auth + onboarding shell
  Auth: placeholder('Account', 'Sign in', 'Auth flow placeholder.'),
  Onboarding: placeholder('Welcome', 'Get started', 'Onboarding placeholder.'),
  Paywall: placeholder('Premium', 'Upgrade', 'Paywall placeholder.'),

  // Add piece flow
  AddPieceStep1: placeholder('New garment', 'Add pieces', 'Step 1 — choose source + multi-photo grid. Coming next.'),
  AddPieceStep2: placeholder('Step 2 of 3', 'Analyzing', 'Per-item progress + counter. Coming next.'),
  AddPieceStep3: placeholder('Step 3 of 3', 'Confirm batch', 'Piece selector + form fields + sticky save. Coming next.'),
  LiveScan: placeholder('Live scan', 'Scan a piece', 'Single-piece live capture mode.'),
  OutfitGenerate: placeholder('Generate', 'New outfit', 'Outfit generation placeholder.'),

  // Outfit / garment / sharing
  Outfits: placeholder('Looks', 'Your outfits'),
  OutfitDetail: placeholder('Today', 'Outfit'),
  EditGarment: placeholder('Edit', 'Edit piece'),
  GarmentDetail: placeholder('Detail', 'Piece'),
  ShareOutfit: placeholder('Share', 'Share outfit'),
  PublicProfile: placeholder('Public', 'Profile'),

  // Stylist / mood / occasion
  StyleChat: placeholder('Stylist', 'Style chat'),
  StyleMe: placeholder('Style me', "What's the occasion?"),
  MoodOutfit: placeholder('Dress how you feel', 'Mood outfit'),
  MoodFlow: placeholder('Mood', 'Pick a mood'),

  // Travel capsule
  TravelCapsule: placeholder('Trip', 'Travel capsule'),
  TravelMustHaves: placeholder('Step 5 of 6', 'Pick must-haves'),
  TravelPackingList: placeholder('Step 6 of 6', 'Packing list'),

  // Discover / lists
  WardrobeGaps: placeholder('Discover', 'Wardrobe gaps'),
  UsedGarments: placeholder('Most worn', 'Used pieces'),
  UnusedOutfits: placeholder('Quiet shelf', 'Unused outfits'),

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

  // Search / filters
  Search: placeholder('Find', 'Search'),
  Filters: placeholder('Refine', 'Filters'),
} as const;

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <Stack.Screen name="MainTabs" component={MainTabsScreen} />

      {/* Auth + onboarding shell — kept as PlaceholderScreen to match the
          file's existing 32-route placeholder pattern. Real `AuthScreen`,
          `OnboardingScreen`, `PaywallScreen` implementations live under
          `mobile/src/screens/` and will be wired in a follow-up screen-
          mounting pass alongside the other ready-to-mount screens. */}
      <Stack.Screen name="Auth" component={Placeholders.Auth} />
      <Stack.Screen name="Onboarding" component={Placeholders.Onboarding} />
      <Stack.Screen name="Paywall" component={Placeholders.Paywall} />

      {/* Add piece flow */}
      <Stack.Screen name="AddPieceStep1" component={AddPieceStep1} />
      <Stack.Screen name="AddPieceStep2" component={AddPieceStep2} />
      <Stack.Screen name="AddPieceStep3" component={AddPieceStep3} />
      <Stack.Screen name="LiveScan" component={Placeholders.LiveScan} />
      <Stack.Screen name="OutfitGenerate" component={Placeholders.OutfitGenerate} />

      {/* Outfit / garment / sharing */}
      <Stack.Screen name="Outfits" component={Placeholders.Outfits} />
      <Stack.Screen name="OutfitDetail" component={Placeholders.OutfitDetail} />
      <Stack.Screen name="EditGarment" component={Placeholders.EditGarment} />
      {/* GarmentDetail mounted in M1 (PR #728) so render polling actually
          renders. Other "real" screens under mobile/src/screens/ stay
          registered as placeholders pending the systematic screen-mount pass
          tracked in the launch plan. */}
      <Stack.Screen name="GarmentDetail" component={GarmentDetailScreen} />
      <Stack.Screen name="ShareOutfit" component={Placeholders.ShareOutfit} />
      <Stack.Screen name="PublicProfile" component={Placeholders.PublicProfile} />

      {/* Stylist / mood / occasion */}
      <Stack.Screen name="StyleChat" component={Placeholders.StyleChat} />
      <Stack.Screen name="StyleMe" component={Placeholders.StyleMe} />
      <Stack.Screen name="MoodOutfit" component={Placeholders.MoodOutfit} />
      <Stack.Screen name="MoodFlow" component={Placeholders.MoodFlow} />

      {/* Travel capsule */}
      <Stack.Screen name="TravelCapsule" component={Placeholders.TravelCapsule} />
      <Stack.Screen name="TravelMustHaves" component={Placeholders.TravelMustHaves} />
      <Stack.Screen name="TravelPackingList" component={Placeholders.TravelPackingList} />

      {/* Discover / lists */}
      <Stack.Screen name="WardrobeGaps" component={Placeholders.WardrobeGaps} />
      <Stack.Screen name="UsedGarments" component={Placeholders.UsedGarments} />
      <Stack.Screen name="UnusedOutfits" component={Placeholders.UnusedOutfits} />

      {/* Settings */}
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SettingsAppearance" component={SettingsAppearanceScreen} />
      <Stack.Screen name="SettingsStyle" component={SettingsStyleScreen} />
      <Stack.Screen name="SettingsNotifications" component={SettingsNotificationsScreen} />
      <Stack.Screen name="SettingsAccount" component={SettingsAccountScreen} />
      <Stack.Screen name="SettingsPrivacy" component={SettingsPrivacyScreen} />

      {/* Profile / account / extras */}
      <Stack.Screen name="Profile" component={Placeholders.Profile} />
      <Stack.Screen name="Notifications" component={Placeholders.Notifications} />
      <Stack.Screen name="ResetPassword" component={Placeholders.ResetPassword} />
      <Stack.Screen name="BillingSuccess" component={Placeholders.BillingSuccess} />
      <Stack.Screen name="BillingCancel" component={Placeholders.BillingCancel} />
      <Stack.Screen name="NotFound" component={Placeholders.NotFound} />

      {/* Search / filters */}
      <Stack.Screen name="Search" component={Placeholders.Search} />
      <Stack.Screen name="Filters" component={Placeholders.Filters} />
    </Stack.Navigator>
  );
}
