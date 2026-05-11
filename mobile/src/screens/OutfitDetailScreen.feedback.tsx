// OutfitDetailScreen — feedback section (rating + notes) (N13 split).
//
// 5-star rating + a notes textarea with a Save/Cancel pair that surfaces
// only when the textarea diverges from the persisted note. Notes
// hydration + persistence handlers live in the parent.

import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Button } from '../components/Button';
import { StarIcon } from '../components/icons';

export type FeedbackSectionProps = {
  rating: number;
  notes: string;
  notesDirty: boolean;
  saveNotePending: boolean;
  onRate: (n: number) => void;
  onNotesChange: (v: string) => void;
  onSaveNote: () => void;
  onCancelNote: () => void;
};

export function FeedbackSection({
  rating,
  notes,
  notesDirty,
  saveNotePending,
  onRate,
  onNotesChange,
  onSaveNote,
  onCancelNote,
}: FeedbackSectionProps) {
  const t = useTokens();
  return (
    <View>
      <Eyebrow style={{ marginBottom: 10 }}>How was it?</Eyebrow>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${n} of 5`}
            onPress={() => onRate(n)}
            hitSlop={6}>
            <StarIcon
              size={28}
              color={n <= rating ? t.accent : t.fg3}
              active={n <= rating}
            />
          </Pressable>
        ))}
      </View>
      <TextInput
        value={notes}
        onChangeText={onNotesChange}
        placeholder="Add a note — what worked, what didn't"
        placeholderTextColor={t.fg3}
        multiline
        style={[
          s.notesInput,
          {
            color: t.fg,
            backgroundColor: t.card,
            borderColor: t.border,
          },
        ]}
      />
      {notesDirty ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Button
            label={saveNotePending ? 'Saving…' : 'Save note'}
            size="sm"
            onPress={onSaveNote}
            disabled={saveNotePending}
          />
          <Button
            label="Cancel"
            size="sm"
            variant="outline"
            onPress={onCancelNote}
            disabled={saveNotePending}
          />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  notesInput: {
    minHeight: 88,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    fontFamily: fonts.ui,
    fontSize: 13,
    textAlignVertical: 'top',
  },
});
