// RevealStep — onboarding step 6.
// 2s loading state, then a mock outfit card. Wraps up the flow.

import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Text, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { Caption } from '../../components/Caption';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { FadeUp } from '../../components/FadeUp';
import { OutfitCard } from '../../components/OutfitCard';
import { t as tr } from '../../lib/i18n';
import { hapticLight, hapticSuccess } from '../../lib/haptics';

const REVEAL_DELAY_MS = 2000;

// Hue values feed the OutfitCard's gradient placeholder tiles.
const MOCK_OUTFIT_HUES = [40, 28, 18];

export function RevealStep({ onComplete }: { onComplete: () => void }) {
  const t = useTokens();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Announce the loading state to assistive tech (P1-15). On Android
    // accessibilityLiveRegion handles this declaratively (see the Spinner
    // wrapper below); on iOS we have to push the announcement explicitly.
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(tr('reveal.loading'));
    }
    const id = setTimeout(() => {
      setLoaded(true);
      hapticSuccess();
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(tr('reveal.outfit.name'));
      }
    }, REVEAL_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 12 }}>
      <View style={{ gap: 8, marginBottom: 18 }}>
        <Eyebrow>{tr('reveal.eyebrow')}</Eyebrow>
        <PageTitle>{tr('reveal.title')}</PageTitle>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {!loaded && (
          <View
            style={{ alignItems: 'center', gap: 14 }}
            accessibilityLiveRegion="polite"
            accessibilityLabel={tr('reveal.loading')}
            accessibilityRole="progressbar">
            <Spinner size={36} />
            <Caption>{tr('reveal.loading')}</Caption>
          </View>
        )}

        {loaded && (
          <FadeUp style={{ alignSelf: 'stretch', alignItems: 'center', gap: 14 }}>
            <View style={{ alignSelf: 'stretch' }}>
              <OutfitCard
                name={tr('reveal.outfit.name')}
                sub={tr('reveal.outfit.sub')}
                hues={MOCK_OUTFIT_HUES}
              />
            </View>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 18,
                color: t.fg2,
                letterSpacing: -0.18,
                textAlign: 'center',
              }}>
              {tr('reveal.tagline')}
            </Text>
          </FadeUp>
        )}
      </View>

      <View>
        <Button
          label={tr('reveal.cta')}
          variant="accent"
          block
          onPress={() => { hapticLight(); onComplete(); }}
          disabled={!loaded}
        />
      </View>
    </View>
  );
}
