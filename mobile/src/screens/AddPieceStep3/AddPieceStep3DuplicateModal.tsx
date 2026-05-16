// Phase 6 — AddPiece Step 3 duplicate-warning modal. Extracted JSX-only
// presentational split so the orchestrator stays under the 600-line target.
// All flow control (visibility gate, acknowledge tracking, nav.reset on
// "View existing") stays at the orchestrator level per the design spec.

import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { radii } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { t as tr } from '../../lib/i18n';

interface AddPieceStep3DuplicateModalProps {
  visible: boolean;
  matchTitle: string | null | undefined;
  onClose: () => void;
  onViewExisting: () => void;
  onAddAnyway: () => void;
}

export function AddPieceStep3DuplicateModal({
  visible,
  matchTitle,
  onClose,
  onViewExisting,
  onAddAnyway,
}: AddPieceStep3DuplicateModalProps) {
  const t = useTokens();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={[s.modalScrim, { backgroundColor: t.scrimBg }]}>
        <View
          style={[s.modalCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <Eyebrow style={{ marginBottom: 6 }}>{tr('addpiece.duplicate.eyebrow')}</Eyebrow>
          <PageTitle size={22}>{tr('addpiece.duplicate.title')}</PageTitle>
          <Caption style={{ marginTop: 8, lineHeight: 19 }}>
            {matchTitle
              ? tr('addpiece.duplicate.body', { title: matchTitle })
              : tr('addpiece.duplicate.bodyNoTitle')}
          </Caption>
          <View style={{ marginTop: 18, gap: 8 }}>
            <Button
              label={tr('addpiece.duplicate.viewExisting')}
              onPress={onViewExisting}
              accessibilityLabel={tr('addpiece.duplicate.viewExisting')}
            />
            <Button
              label={tr('addpiece.duplicate.addAnyway')}
              variant="quiet"
              onPress={onAddAnyway}
              accessibilityLabel={tr('addpiece.duplicate.addAnyway')}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalScrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 22,
  },
});
