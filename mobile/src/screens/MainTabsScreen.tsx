// Custom tab container — renders the active tab's screen, keeps the other 3 mounted but hidden
// (`display: 'none'`) so scroll position survives a switch. The floating BottomNav lives here,
// not inside each tab screen, so non-tab routes (AddPiece, OutfitDetail, …) push above it cleanly.
//
// Why not @react-navigation/bottom-tabs? The design's center FAB pushes onto the parent stack,
// not "switches tab," so a custom container is simpler than a custom tabBar component.

import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type RouteProp, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { BottomNav, type TabId } from '../components/BottomNav';
import { OfflineBanner } from '../components/OfflineBanner';
import { CoachOverlay } from '../components/CoachOverlay';
import { useFirstRunCoach, COACH_TOUR_TOTAL } from '../hooks/useFirstRunCoach';
import { t as tr } from '../lib/i18n';
import { HomeScreen } from './HomeScreen';
import { WardrobeScreen } from './WardrobeScreen';
import { PlanScreen } from './PlanScreen';
import { InsightsScreen } from './InsightsScreen';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;
type Route = RouteProp<RootStackParamList, 'MainTabs'>;

export function MainTabsScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const initial: TabId = route.params?.initialTab ?? 'today';
  const [tab, setTab] = useState<TabId>(initial);

  // Sync with subsequent navigate('MainTabs', { initialTab: ... }) calls — useState only
  // honours the initial value, so a deep-link / external nav.navigate that updates params
  // on an already-mounted MainTabs would otherwise be silently ignored. Codex P2 #2 on PR #699.
  const paramTab = route.params?.initialTab;
  useEffect(() => {
    if (paramTab) setTab(paramTab);
  }, [paramTab]);

  // M27 — first-run coach overlay step 3 (FAB on the BottomNav). The
  // FAB is the gold (+) button between Wardrobe and Plan. We wrap the
  // entire BottomNav in a measurable View ref; CoachOverlay's cutout
  // ends up highlighting the whole capsule pill. Targeting just the
  // FAB would require threading a ref into BottomNav — the wider
  // highlight reads cleanly and the caption ("Tap (+) to add a piece")
  // makes the intent unambiguous.
  const coach = useFirstRunCoach();
  const fabRef = useRef<View | null>(null);
  const showFabCoach = coach.shouldShow && coach.currentStep === 2;

  // M27 R1 — orchestrate tab switches as the coach tour advances. Each
  // step lives on a different surface; without auto-switching, the
  // overlay would either surface against a hidden (display:'none')
  // subscreen and measure 0×0, or never appear at all because the user
  // hasn't navigated. We do this from a single useEffect on currentStep
  // so the tab in `tab` state always matches the step the user is on,
  // regardless of how `advance()` was called (per-screen Next, scrim tap,
  // etc.).
  //
  //   step 0 (Home)     → tab='today'
  //   step 1 (Wardrobe) → tab='wardrobe'
  //   step 2 (FAB)      → tab='wardrobe' (FAB lives on the same nav as
  //                        Wardrobe; staying here keeps the user oriented)
  //   step 3 (Outfits)  → handled by HomeScreen's onNext via nav.navigate
  //                        ('Outfits') because Outfits is a stack route,
  //                        not a tab.
  useEffect(() => {
    if (!coach.shouldShow) return;
    if (coach.currentStep === 0 && tab !== 'today') setTab('today');
    else if (
      (coach.currentStep === 1 || coach.currentStep === 2) &&
      tab !== 'wardrobe'
    ) {
      setTab('wardrobe');
    }
    // step 3 navigates onto a non-tab stack route from OutfitsScreen's
    // Next handler — no tab change needed here.
  }, [coach.shouldShow, coach.currentStep, tab]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, display: tab === 'today'    ? 'flex' : 'none' }} pointerEvents={tab === 'today'    ? 'auto' : 'none'}>
        <HomeScreen goTab={setTab} isActive={tab === 'today'} />
      </View>
      <View style={{ flex: 1, display: tab === 'wardrobe' ? 'flex' : 'none' }} pointerEvents={tab === 'wardrobe' ? 'auto' : 'none'}>
        <WardrobeScreen isActive={tab === 'wardrobe'} />
      </View>
      <View style={{ flex: 1, display: tab === 'plan'     ? 'flex' : 'none' }} pointerEvents={tab === 'plan'     ? 'auto' : 'none'}>
        <PlanScreen />
      </View>
      <View style={{ flex: 1, display: tab === 'insights' ? 'flex' : 'none' }} pointerEvents={tab === 'insights' ? 'auto' : 'none'}>
        {/* `active` lets InsightsScreen drive its mount-time animations (gauge rings)
            from tab visibility instead of plain mount — every tab stays mounted to
            preserve scroll position, so the mount fires while Insights is hidden. */}
        <InsightsScreen active={tab === 'insights'} />
      </View>
      {/* M5 — global offline banner. Self-renders null when online or
          when the queue is empty, so it occupies zero space in the steady
          state and only appears when there's something the user should
          know about. Anchored to the safe-area top inset so dynamic-island /
          notch / status-bar heights all draw cleanly across devices. */}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: insets.top, left: 0, right: 0 }}>
        <OfflineBanner />
      </View>
      <View ref={fabRef} collapsable={false}>
        <BottomNav
          active={tab}
          onTab={setTab}
          onAdd={() => nav.navigate('AddPieceStep1')}
        />
      </View>

      {/* M27 — first-run coach overlay step 3 (FAB / Add). Surfaced from
          the tab container so it always lives above whichever tab is
          active; cutout pinpoints the BottomNav capsule.
          M27 R1 — onNext also pushes the Outfits stack route before
          advancing so step 4 (Outfits) lands on the right screen. The
          previous wiring left the user on Wardrobe and the step-4
          overlay never surfaced because OutfitsScreen wasn't mounted. */}
      <CoachOverlay
        visible={showFabCoach}
        targetRef={fabRef}
        caption={tr('coachTour.step.add')}
        ctaLabel={tr('coachTour.next')}
        onNext={() => {
          nav.navigate('Outfits');
          coach.advance();
        }}
        onSkip={coach.skip}
        step={3}
        total={COACH_TOUR_TOTAL}
      />
    </View>
  );
}
