// TypedConfirmModal — destructive-action gate that requires the user to
// type a literal string ("DELETE" / "RESET") before the Confirm CTA
// enables. Mirrors web's clickjacking-mitigation pattern from PR #712:
// a single-tap destructive Alert is too easy to fat-finger, especially
// for App Store guideline 5.1.1(v) account deletion which reviewers
// explicitly test.
//
// Shape:
//   <TypedConfirmModal
//     open={...}
//     title="Delete account"
//     body="This permanently removes your wardrobe, outfits, ..."
//     requiredText="DELETE"           // case-sensitive
//     confirmLabel="Delete account"
//     destructive                       // styles confirm button red
//     isPending                         // disables both CTAs while in flight
//     onConfirm={...}
//     onCancel={...}
//   />

import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from './Eyebrow';
import { PageTitle } from './PageTitle';
import { Caption } from './Caption';
import { Button } from './Button';
import { t as tr } from '../lib/i18n';

export interface TypedConfirmModalProps {
  open: boolean;
  title: string;
  body: string;
  requiredText: string;
  confirmLabel: string;
  destructive?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TypedConfirmModal({
  open,
  title,
  body,
  requiredText,
  confirmLabel,
  destructive,
  isPending,
  onConfirm,
  onCancel,
}: TypedConfirmModalProps) {
  const t = useTokens();
  const [value, setValue] = useState('');

  // Clear the typed text whenever the modal closes so a re-open starts
  // fresh — without this a user who cancels and re-opens would see
  // their previous "DELETE" still typed and the confirm button live.
  useEffect(() => {
    if (!open) setValue('');
  }, [open]);

  const matches = value === requiredText;

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={isPending ? undefined : onCancel}>
      <View style={[s.scrim, { backgroundColor: t.scrimBg }]}>
        <View
          style={[s.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Eyebrow style={{ marginBottom: 6 }}>{tr('confirmModal.eyebrow')}</Eyebrow>
          <PageTitle size={22}>{title}</PageTitle>
          <Caption style={{ marginTop: 8, lineHeight: 19 }}>{body}</Caption>
          <Caption style={{ marginTop: 14 }}>
            {/* Locales that need to flip word order around the typed token
                can rephrase this string; the {required} placeholder marks
                where the literal text goes (with bold styling preserved). */}
            {(() => {
              const template = tr('confirmModal.instruction');
              const [before, after] = template.split('{required}');
              return (
                <>
                  {before}
                  <Text style={{ fontFamily: fonts.uiSemi, color: t.fg }}>
                    {requiredText}
                  </Text>
                  {after ?? ''}
                </>
              );
            })()}
          </Caption>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isPending}
            accessibilityLabel={`Type ${requiredText} to confirm`}
            style={[
              s.input,
              {
                borderColor: matches ? t.accent : t.border,
                backgroundColor: t.bg,
                color: t.fg,
              },
            ]}
            placeholderTextColor={t.fg3}
            placeholder={requiredText}
          />
          <View style={{ marginTop: 16, gap: 8 }}>
            <Button
              label={isPending ? tr('confirmModal.pending') : confirmLabel}
              variant={destructive ? 'primary' : 'accent'}
              destructive={destructive}
              disabled={!matches || !!isPending}
              onPress={onConfirm}
              accessibilityLabel={confirmLabel}
            />
            <Button
              label={tr('confirmModal.cancel')}
              variant="quiet"
              disabled={!!isPending}
              onPress={onCancel}
              accessibilityLabel={tr('confirmModal.cancel')}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 22,
  },
  input: {
    marginTop: 8,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontFamily: fonts.uiMed,
    fontSize: 14,
    letterSpacing: 1.2,
  },
});
