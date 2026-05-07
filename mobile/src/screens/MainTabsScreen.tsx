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

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, display: tab === 'today'    ? 'flex' : 'none' }} pointerEvents={tab === 'today'    ? 'auto' : 'none'}>
        <HomeScreen goTab={setTab} />
      </View>
      <View style={{ flex: 1, display: tab === 'wardrobe' ? 'flex' : 'none' }} pointerEvents={tab === 'wardrobe' ? 'auto' : 'none'}>
        <WardrobeScreen />
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
          active; cutout pinpoints the BottomNav capsule. */}
      <CoachOverlay
        visible={showFabCoach}
        targetRef={fabRef}
        caption={tr('coachTour.step.add')}
        ctaLabel={tr('coachTour.next')}
        onNext={coach.advance}
        onSkip={coach.skip}
        step={3}
        total={COACH_TOUR_TOTAL}
      />
    </View>
  );
}
