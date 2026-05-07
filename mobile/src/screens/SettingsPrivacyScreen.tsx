// Settings · Privacy & data — info card + actions for export, reset memory, delete.
// Mirrors design_handoff_burs_rn/source/audit-screens.jsx SettingsPrivacyScreen.

import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { SettingsRow } from '../components/SettingsRow';
import { TypedConfirmModal } from '../components/TypedConfirmModal';
import { BackIcon, RotateIcon, TrashIcon, ShieldIcon } from '../components/icons';
import { useDeleteAccount } from '../hooks/useDeleteAccount';
import { useResetStyleMemory } from '../hooks/useResetStyleMemory';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SettingsPrivacyScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const deleteAccount = useDeleteAccount();
  const resetMemory = useResetStyleMemory();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const handleConfirmDelete = () => {
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        setDeleteOpen(false);
        // Same nav.reset rationale as SettingsAccountScreen: AuthContext's
        // SIGNED_OUT handler clears auth + caches but doesn't touch the
        // nav stack, so the deleted user would otherwise stay on this
        // mounted screen.
        nav.reset({ index: 0, routes: [{ name: 'Auth' }] });
      },
      onError: (err) => {
        setDeleteOpen(false);
        Alert.alert(
          tr('settings.delete_account.title'),
          err instanceof Error ? err.message : tr('settings.delete_account.error'),
        );
      },
    });
  };

  const handleConfirmReset = () => {
    resetMemory.mutate(undefined, {
      onSuccess: () => {
        setResetOpen(false);
        Alert.alert(
          tr('settings.reset_memory.success.title'),
          tr('settings.reset_memory.success.body'),
        );
      },
      onError: (err) => {
        setResetOpen(false);
        Alert.alert(
          tr('settings.reset_memory.title'),
          err instanceof Error ? err.message : tr('settings.reset_memory.error'),
        );
      },
    });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ HEADER ============ */}
        <View style={s.headerRow}>
          <IconBtn ariaLabel={tr('common.back')} onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>{tr('settings.privacy.headerEyebrow')}</Eyebrow>
            <PageTitle>{tr('settings.privacy.headerTitle')}</PageTitle>
          </View>
        </View>

        {/* ============ INFO CARD ============ */}
        <Card hero padding={18}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: t.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <ShieldIcon size={22} color={t.accent} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Eyebrow>{tr('settings.privacy.info.eyebrow')}</Eyebrow>
              <Caption>{tr('settings.privacy.info.body')}</Caption>
              <Button
                label={tr('settings.privacy.info.cta')}
                variant="quiet"
                size="sm"
                onPress={() =>
                  Alert.alert(
                    tr('settings.privacy.alert.title'),
                    tr('settings.privacy.alert.body'),
                  )
                }
                style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
              />
            </View>
          </View>
        </Card>

        {/* ============ ACTIONS ============ */}
        {/* "Export all my data" row intentionally omitted: there is no edge
            function or job behind it yet, and App Store guideline 5.1.1(a)(ii)
            actively tests data-export claims. The row returns once a real
            export pipeline ships. */}
        <Card padding={4}>
          <SettingsRow
            icon={<RotateIcon size={18} color={t.accent} />}
            title={tr('settings.row.resetMemory')}
            caption={tr('settings.row.resetMemory.caption')}
            onPress={() => setResetOpen(true)}
          />
          <SettingsRow
            icon={<TrashIcon size={18} color={t.destructive} />}
            title={tr('settings.account.row.delete')}
            caption={tr('settings.account.row.delete.caption')}
            destructive
            last
            onPress={() => setDeleteOpen(true)}
          />
        </Card>
      </ScrollView>

      <TypedConfirmModal
        open={resetOpen}
        title={tr('settings.reset_memory.title')}
        body={tr('settings.reset_memory.body')}
        requiredText={tr('settings.reset_memory.required')}
        confirmLabel={tr('settings.reset_memory.confirm')}
        destructive
        isPending={resetMemory.isPending}
        onConfirm={handleConfirmReset}
        onCancel={() => setResetOpen(false)}
      />

      <TypedConfirmModal
        open={deleteOpen}
        title={tr('settings.delete_account.title')}
        body={tr('settings.delete_account.body')}
        requiredText={tr('settings.delete_account.required')}
        confirmLabel={tr('settings.delete_account.confirm')}
        destructive
        isPending={deleteAccount.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
});
