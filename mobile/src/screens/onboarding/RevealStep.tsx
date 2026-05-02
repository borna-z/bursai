// RevealStep — onboarding step 6.
// 2s loading state, then a mock outfit card. Wraps up the flow.

import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { Caption } from '../../components/Caption';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { FadeUp } from '../../components/FadeUp';
import { OutfitCard } from '../../components/OutfitCard';

const REVEAL_DELAY_MS = 2000;

const MOCK_OUTFIT = {
  name: 'First impressions',
  sub: 'Your first look',
  // Hue values feed the OutfitCard's gradient placeholder tiles.
  hues: [40, 28, 18],
};

export function RevealStep({ onComplete }: { onComplete: () => void }) {
  const t = useTokens();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setLoaded(true), REVEAL_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 12 }}>
      <View style={{ gap: 8, marginBottom: 18 }}>
        <Eyebrow>Your first look</Eyebrow>
        <PageTitle>Based on your style</PageTitle>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {!loaded && (
          <View style={{ alignItems: 'center', gap: 14 }}>
            <Spinner size={36} />
            <Caption>Generating your first outfit…</Caption>
          </View>
        )}

        {loaded && (
          <FadeUp style={{ alignSelf: 'stretch', alignItems: 'center', gap: 14 }}>
            <View style={{ alignSelf: 'stretch' }}>
              <OutfitCard
                name={MOCK_OUTFIT.name}
                sub={MOCK_OUTFIT.sub}
                hues={MOCK_OUTFIT.hues}
              />
            </View>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 18,
                color: t.fg2,
                letterSpacing: -0.18,
                fontWeight: '500',
                textAlign: 'center',
              }}>
              This is just the beginning.
            </Text>
          </FadeUp>
        )}
      </View>

      <View>
        <Button
          label="Go to my wardrobe"
          variant="accent"
          block
          onPress={onComplete}
          disabled={!loaded}
        />
      </View>
    </View>
  );
}
