// SettingsStyleScreen — collapsible section shell (N13 split).
//
// Card with header + optional Apply button. The ChevronIcon rotates on
// expand to mirror web's `<Collapsible>` accordion affordance. The dirty
// dot surfaces unsaved edits when the section is collapsed.

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ChevronIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';
import type { SectionId } from './SettingsStyleScreen.helpers';

export function Section({
  id,
  open,
  dirty,
  isPending,
  onToggle,
  onApply,
  summary,
  children,
}: {
  id: SectionId;
  open: boolean;
  dirty: boolean;
  isPending: boolean;
  onToggle: () => void;
  onApply: () => void;
  summary?: string;
  children: React.ReactNode;
}) {
  const t = useTokens();
  return (
    <Card padding={0}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={tr(`settingsStyle.editor.section.${id}.title`)}
        style={({ pressed }) => ({
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: pressed ? 0.85 : 1,
        })}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 15,
              color: t.fg,
              letterSpacing: -0.15,
            }}>
            {tr(`settingsStyle.editor.section.${id}.title`)}
          </Text>
          {!open && summary ? (
            <Caption style={{ marginTop: 2 }} numberOfLines={1}>
              {summary}
            </Caption>
          ) : null}
        </View>
        {dirty && !open ? (
          <View
            accessibilityLabel={tr('settingsStyle.editor.unsavedDot')}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: t.accent,
            }}
          />
        ) : null}
        <View
          style={{
            transform: [{ rotate: open ? '180deg' : '0deg' }],
          }}>
          <ChevronIcon size={14} color={t.fg2} />
        </View>
      </Pressable>
      {open ? (
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 16,
            paddingTop: 4,
            borderTopWidth: 1,
            borderTopColor: t.border,
          }}>
          {children}
          <View style={{ marginTop: 16, alignItems: 'flex-end' }}>
            <Button
              label={
                isPending
                  ? tr('settingsStyle.editor.apply.busy')
                  : tr('settingsStyle.editor.apply.label')
              }
              variant="primary"
              size="sm"
              onPress={onApply}
              disabled={!dirty || isPending}
              accessibilityState={{ disabled: !dirty || isPending, busy: isPending }}
            />
          </View>
        </View>
      ) : null}
    </Card>
  );
}
