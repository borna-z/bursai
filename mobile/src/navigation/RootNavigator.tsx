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

// One placeholder factory per route — keeps the file flat and the eyebrow/title accurate.
const placeholder = (eyebrow: string, title: string, body?: string) => () =>
  <PlaceholderScreen eyebrow={eyebrow} title={title} body={body} />;

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
      <Stack.Screen name="AddPieceStep1" component={placeholder('New garment', 'Add pieces', 'Step 1 — choose source + multi-photo grid. Coming next.')} />
      <Stack.Screen name="AddPieceStep2" component={placeholder('Step 2 of 3', 'Analyzing', 'Per-item progress + counter. Coming next.')} />
      <Stack.Screen name="AddPieceStep3" component={placeholder('Step 3 of 3', 'Confirm batch', 'Piece selector + form fields + sticky save. Coming next.')} />
      <Stack.Screen name="LiveScan" component={placeholder('Live scan', 'Scan a piece', 'Single-piece live capture mode.')} />

      {/* Outfit / garment / sharing */}
      <Stack.Screen name="Outfits" component={placeholder('Looks', 'Your outfits')} />
      <Stack.Screen name="OutfitDetail" component={placeholder('Today', 'Outfit')} />
      <Stack.Screen name="EditGarment" component={placeholder('Edit', 'Edit piece')} />
      <Stack.Screen name="GarmentDetail" component={placeholder('Detail', 'Piece')} />
      <Stack.Screen name="ShareOutfit" component={placeholder('Share', 'Share outfit')} />
      <Stack.Screen name="PublicProfile" component={placeholder('Public', 'Profile')} />

      {/* Stylist / mood / occasion */}
      <Stack.Screen name="StyleChat" component={placeholder('Stylist', 'Style chat')} />
      <Stack.Screen name="StyleMe" component={placeholder('Style me', "What's the occasion?")} />
      <Stack.Screen name="MoodOutfit" component={placeholder('Dress how you feel', 'Mood outfit')} />
      <Stack.Screen name="MoodFlow" component={placeholder('Mood', 'Pick a mood')} />

      {/* Travel capsule */}
      <Stack.Screen name="TravelCapsule" component={placeholder('Trip', 'Travel capsule')} />
      <Stack.Screen name="TravelMustHaves" component={placeholder('Step 5 of 6', 'Pick must-haves')} />
      <Stack.Screen name="TravelPackingList" component={placeholder('Step 6 of 6', 'Packing list')} />

      {/* Discover / lists */}
      <Stack.Screen name="WardrobeGaps" component={placeholder('Discover', 'Wardrobe gaps')} />
      <Stack.Screen name="UsedGarments" component={placeholder('Most worn', 'Used pieces')} />
      <Stack.Screen name="UnusedOutfits" component={placeholder('Quiet shelf', 'Unused outfits')} />

      {/* Settings */}
      <Stack.Screen name="Settings" component={placeholder('Settings', 'Preferences')} />
      <Stack.Screen name="SettingsAppearance" component={placeholder('Appearance', 'Theme & motion')} />
      <Stack.Screen name="SettingsStyle" component={placeholder('Style', 'Your preferences')} />
      <Stack.Screen name="SettingsNotifications" component={placeholder('Notifications', 'Reminders')} />
      <Stack.Screen name="SettingsAccount" component={placeholder('Account', 'Sign-in & billing')} />
      <Stack.Screen name="SettingsPrivacy" component={placeholder('Privacy', 'Data & sharing')} />

      {/* Profile / account / extras */}
      <Stack.Screen name="Profile" component={placeholder('You', 'Profile')} />
      <Stack.Screen name="Notifications" component={placeholder('Inbox', 'Notifications')} />
      <Stack.Screen name="ResetPassword" component={placeholder('Account', 'Reset password')} />
      <Stack.Screen name="BillingSuccess" component={placeholder('Welcome', 'Premium activated')} />
      <Stack.Screen name="BillingCancel" component={placeholder('Cancelled', 'Plan cancelled')} />
      <Stack.Screen name="NotFound" component={placeholder('Off the rail', '404')} />

      {/* Search / filters */}
      <Stack.Screen name="Search" component={placeholder('Find', 'Search')} />
      <Stack.Screen name="Filters" component={placeholder('Refine', 'Filters')} />
    </Stack.Navigator>
  );
}
