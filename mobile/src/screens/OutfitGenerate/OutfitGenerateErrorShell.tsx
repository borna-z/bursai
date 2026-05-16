// Error / paywall shell for OutfitGenerateScreen — extracted in Phase 3
// polish. Two related branches share the same header/layout chrome:
//   • Paywall — engine returned the `subscription_required` sentinel.
//   • Generic / anchor-miss / invalid-outfit error.
//
// The orchestrator decides which branch via the `variant` prop and feeds
// resolved copy + handlers. We keep the header layout identical to the
// inlined version so the visual diff stays zero.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { Button } from '../../components/Button';
import { IconBtn } from '../../components/IconBtn';
import { ErrorState } from '../../components/ErrorState';
import { CloseIcon } from '../../components/icons';
import { hapticLight } from '../../lib/haptics';
import { t as tr } from '../../lib/i18n';

interface BaseProps {
  onClose: () => void;
}

export interface OutfitGeneratePaywallShellProps extends BaseProps {
  onBack: () => void;
}

export function OutfitGeneratePaywallShell({ onClose, onBack }: OutfitGeneratePaywallShellProps) {
  const t = useTokens();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <IconBtn ariaLabel="Close" onPress={() => { hapticLight(); onClose(); }}>
          <CloseIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Eyebrow>Premium feature</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>New look</PageTitle>
        </View>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.loadingShell}>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontSize: 18,
            color: t.fg,
            textAlign: 'center',
            letterSpacing: -0.18,
          }}>
          Outfit generation is part of BURS Premium
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontFamily: fonts.uiMed,
            fontSize: 12,
            color: t.fg2,
            letterSpacing: -0.1,
            textAlign: 'center',
          }}>
          Upgrade to keep generating looks.
        </Text>
        <View style={{ marginTop: 18 }}>
          <Button label="Back" variant="outline" onPress={onBack} />
        </View>
      </View>
    </SafeAreaView>
  );
}

export interface OutfitGenerateErrorShellProps extends BaseProps {
  eyebrow: string;
  title: string;
  body: string;
  onRetry: () => void;
  showRemoveAnchor: boolean;
  onRemoveAnchor: () => void;
}

export function OutfitGenerateErrorShell({
  onClose,
  eyebrow,
  title,
  body,
  onRetry,
  showRemoveAnchor,
  onRemoveAnchor,
}: OutfitGenerateErrorShellProps) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <IconBtn ariaLabel="Close" onPress={() => { hapticLight(); onClose(); }}>
          <CloseIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>New look</PageTitle>
        </View>
        <View style={{ width: 36 }} />
      </View>
      <ErrorState title={title} body={body} onRetry={onRetry} />
      {showRemoveAnchor ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>
          <Button label={tr('anchor.removeAnchor')} variant="quiet" onPress={onRemoveAnchor} block />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  loadingShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
});
