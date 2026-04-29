// Root native-stack registers every route from the design handoff.
// MainTabs (containing Home/Wardrobe/Plan/Insights) is the initial screen.
// Every other route is currently a `PlaceholderScreen` — swap in real implementations as they ship.
//
// Build order tracked in mobile/CLAUDE.md.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabsScreen } from '../screens/MainTabsScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import type { TabId } from '../components/BottomNav';

export type TabName = TabId;

export type RootStackParamList = {
  MainTabs: { initialTab?: TabId } | undefined;

  // Add piece flow (3 steps)
  AddPieceStep1: undefined;
  AddPieceStep2: undefined;
  AddPieceStep3: undefined;
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
  MoodFlow: undefined;

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
  Filters: undefined;
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
  // Add piece flow
  AddPieceStep1: placeholder('New garment', 'Add pieces', 'Step 1 — choose source + multi-photo grid. Coming next.'),
  AddPieceStep2: placeholder('Step 2 of 3', 'Analyzing', 'Per-item progress + counter. Coming next.'),
  AddPieceStep3: placeholder('Step 3 of 3', 'Confirm batch', 'Piece selector + form fields + sticky save. Coming next.'),
  LiveScan: placeholder('Live scan', 'Scan a piece', 'Single-piece live capture mode.'),

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

      {/* Add piece flow */}
      <Stack.Screen name="AddPieceStep1" component={Placeholders.AddPieceStep1} />
      <Stack.Screen name="AddPieceStep2" component={Placeholders.AddPieceStep2} />
      <Stack.Screen name="AddPieceStep3" component={Placeholders.AddPieceStep3} />
      <Stack.Screen name="LiveScan" component={Placeholders.LiveScan} />

      {/* Outfit / garment / sharing */}
      <Stack.Screen name="Outfits" component={Placeholders.Outfits} />
      <Stack.Screen name="OutfitDetail" component={Placeholders.OutfitDetail} />
      <Stack.Screen name="EditGarment" component={Placeholders.EditGarment} />
      <Stack.Screen name="GarmentDetail" component={Placeholders.GarmentDetail} />
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

      {/* Search / filters */}
      <Stack.Screen name="Search" component={Placeholders.Search} />
      <Stack.Screen name="Filters" component={Placeholders.Filters} />
    </Stack.Navigator>
  );
}
