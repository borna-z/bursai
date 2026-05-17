// Phase 6 — AddPiece Step 3 save flow.
//
// Extracted from `AddPieceStep3.tsx`. Owns:
//   - The `useAddGarment` mutation call (including the upload-await window
//     before the mutation runs).
//   - Three `useRef` reentrancy / state guards (`savingRef`, `savedRef`,
//     `pendingCleanupRef`) coordinated with the parent's unmount cleanup.
//   - Batch handling (forward-to-next-pending, last-item terminal).
//   - The `GarmentSaveChoiceSheet` (Studio vs Original choice).
//   - Offline-queue branch + error mapping.
//
// What this module does NOT do:
//   - The unmount cleanup effect that deletes orphan storage objects. That
//     stays in the orchestrator because it captures route params at mount
//     and must fire when the screen unmounts — extracting it would risk
//     reordering vs the save flow. The orchestrator owns the unmount effect
//     and consults `savedRef` (exposed via the hook's return) to know
//     whether the save landed; the hook coordinates the deferred-cleanup
//     handoff via `pendingCleanupRef`.
//
// Public surface — the orchestrator imports `useAddPieceStep3SaveFlow` (logic)
// and `<AddPieceStep3SaveFlow />` (the choice-sheet renderer). They share a
// handle: the hook produces the handle, the component reads `open` / `isSaving`
// off the handle. Splitting hook + component keeps the orchestrator's save
// button trivially bindable while the visual surface lives in this module.

import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { GarmentSaveChoiceSheet } from '../../components/GarmentSaveChoiceSheet';
import {
  useAddGarment,
  OfflineQueuedError,
  type AddGarmentParams,
  type AddGarmentSource,
} from '../../hooks/useAddGarment';
import { hapticLight, hapticSuccess } from '../../lib/haptics';
import { trackEvent, markAddPieceCheckpoint } from '../../lib/analytics';
import {
  dropBatch,
  markItemSaved,
  nextPendingIndex,
} from '../../lib/batchPipeline';
import {
  takePendingUpload,
  type PendingUploadPromise,
} from '../../lib/pendingUpload';
import { t as tr } from '../../lib/i18n';
import { showToast } from '../../lib/toast';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { GarmentFormState } from './garmentMetadataForm.types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Snapshot of the picker state at mount — used to compute the ai_overridden
// audit map. Equivalent to the legacy `initialPickersRef.current` shape.
export interface InitialPickerSnapshot {
  title: string;
  category: string;
  subcategory: string;
  primaryColor: string;
  secondaryColor: string;
  material: string;
  fit: string;
  pattern: string;
  seasonsKey: string; // sorted-joined seasons array
  formality: 1 | 2 | 3 | 4 | 5 | null;
}

// Inputs to the save flow. The orchestrator passes route params + analyzer
// snapshot + a function that reads the latest form state (live picker
// snapshot) without re-rendering when it changes.
export interface AddPieceStep3SaveFlowInput {
  storagePath: string | null;
  uploadId?: string;
  photoUri: string;
  analysis: AddGarmentParams['analysis'];
  source: AddGarmentSource;
  batch?: { batchId: string; index: number; total: number };
  // Live picker snapshot reader. The orchestrator caches the latest form
  // state in a ref; this getter avoids a closure-capture stale-state bug
  // (handleSave references whatever the user picked at the moment of save,
  // not at the moment the callback was created).
  getFormState: () => GarmentFormState;
  initialSnapshot: InitialPickerSnapshot;
  // Cached upload promise — the orchestrator may have already consumed it to
  // resolve the masked-storage path for the duplicate query / hero preview.
  uploadPromiseRef: React.MutableRefObject<PendingUploadPromise | null>;
  // Marked `true` once the save lands or the offline queue swallows the row.
  // The orchestrator's unmount cleanup reads this to decide whether to delete
  // the orphan storage object.
  savedRef: React.MutableRefObject<boolean>;
  // Closure parked by the orchestrator's unmount cleanup if a save was in
  // flight when the screen was dismissed. handleSave's finally invokes it
  // after savingRef clears.
  pendingCleanupRef: React.MutableRefObject<(() => void) | null>;
}

export interface SaveFlowHandle {
  // Imperative trigger for the choice sheet — called by the orchestrator's
  // sticky save bar. Mirrors `openChoiceSheet` from the pre-refactor screen.
  openSheet: () => void;
}

// Public return shape from `useAddPieceStep3SaveFlow`. The `savingRef` is the
// SYNCHRONOUS in-flight signal — flipped to `true` inside `handleSave` BEFORE
// any await, flipped back in `finally`. The orchestrator's unmount cleanup
// MUST consult this ref (not a state-mirrored one) so the cleanup observes
// the in-flight save even when the unmount lands in the same tick as the
// user's Studio/Original tap, before any re-render mirrors the busy state
// into a render-side ref. Codex P2 on PR #858.
export interface SaveFlowResult {
  saveBusy: boolean;
  openSheet: () => void;
  saveFlowElement: React.ReactElement;
  savingRef: React.MutableRefObject<boolean>;
}

// Map raw exception text to user-facing copy. PostgREST and supabase-js bubble
// up wire-format messages ("duplicate key value violates unique constraint",
// "FetchError: Network request failed", etc.) that are noise to the end user.
function friendlySaveError(err: unknown): string {
  if (!(err instanceof Error)) return tr('addpiece.step3.error.generic');
  const m = err.message.toLowerCase();
  if (m.includes('network') || m.includes('fetch')) {
    return tr('addpiece.step3.error.network');
  }
  if (m.includes('duplicate')) {
    return tr('addpiece.step3.error.duplicate');
  }
  if (m.includes('not authenticated')) {
    return tr('addpiece.step3.error.notSignedIn');
  }
  if (m.includes('upload was lost') || m.includes('re-add')) {
    return tr('addpiece.step3.error.uploadLost');
  }
  return tr('addpiece.step3.error.generic');
}

/**
 * useAddPieceStep3SaveFlow — encapsulates the entire save mutation lifecycle.
 *
 * Returns `{ saveBusy, openSheet }` for the orchestrator's save bar plus a
 * `<AddPieceStep3SaveFlow />` instance (mounted by the orchestrator alongside
 * its other JSX) that renders the choice sheet.
 */
export function useAddPieceStep3SaveFlow(
  input: AddPieceStep3SaveFlowInput,
): SaveFlowResult {
  const nav = useNavigation<Nav>();
  const addGarment = useAddGarment();

  const [choiceOpen, setChoiceOpen] = useState(false);
  // In-flight guard — covers the pre-mutation upload-await window where
  // `addGarment.isPending` is still false. Without this, a user could reopen
  // the sheet and tap again while the first call is still waiting on the
  // upload promise; both paths would then execute mutateAsync in parallel and
  // create duplicate garment rows. Codex P1 on PR #725.
  //
  // Ref + state pair: the ref is the source of truth for reentrancy (state
  // setters are async, so two double-taps fired in the same tick both see
  // the stale `isSaving === false` snapshot). The state mirrors the ref so
  // the sheet + Save button can disable themselves on rerender.
  const savingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  // Resolve the deferred storagePath if Step 2 navigated us here before the
  // upload landed. Idempotent — repeat calls return the cached promise.
  const getUploadPromise = useCallback((): PendingUploadPromise | null => {
    if (input.uploadPromiseRef.current) return input.uploadPromiseRef.current;
    if (!input.uploadId) return null;
    const promise = takePendingUpload(input.uploadId);
    if (promise) input.uploadPromiseRef.current = promise;
    return input.uploadPromiseRef.current;
  }, [input.uploadId, input.uploadPromiseRef]);

  const handleSave = useCallback(
    async (enableStudioQuality: boolean) => {
      // Reentrancy guard.
      if (savingRef.current) return;
      savingRef.current = true;
      setIsSaving(true);
      hapticLight();
      setChoiceOpen(false);

      const { storagePath, photoUri, analysis, source, batch } = input;
      const form = input.getFormState();
      const initial = input.initialSnapshot;

      // Price validation. The previous `parseFloat` path silently
      // truncated European decimals ("12,50" → 12) and accepted negatives
      // pasted in from another app. Mirror `EditGarmentScreen.handleSave`
      // — use `Number()` so commas / scientific notation / letters fail
      // the finite check, and reject negatives. Empty input is allowed and
      // saves as `undefined` → `null` on the row.
      const trimmedPrice = form.price.trim();
      let parsedPrice: number | undefined;
      if (trimmedPrice.length > 0) {
        const n = Number(trimmedPrice);
        if (!Number.isFinite(n) || n < 0) {
          showToast(
            'error',
            tr('editGarment.invalidPrice.title'),
            tr('editGarment.invalidPrice.body'),
          );
          savingRef.current = false;
          setIsSaving(false);
          return;
        }
        parsedPrice = n;
      }

      try {
        // Resolve the storagePath. If Step 2 already finished its upload, the
        // param is populated and we save immediately. If not, await the in-
        // flight upload before calling useAddGarment.
        let resolvedPath = storagePath;
        if (!resolvedPath) {
          const promise = getUploadPromise();
          if (!promise) {
            throw new Error('Upload was lost — please re-add this piece.');
          }
          try {
            const upRes = await promise;
            resolvedPath = upRes.storagePath;
          } catch (uploadErr) {
            // Codex round 11 P2 on PR #725 — a failed upload poisons
            // uploadPromiseRef; a subsequent Save tap would re-await the same
            // rejected promise and fail identically. Clear the cached promise
            // so the next attempt's getUploadPromise() returns null and we
            // surface "Upload was lost".
            input.uploadPromiseRef.current = null;
            throw uploadErr;
          }
        }

        // Compute the ai_overridden audit map by comparing the current picker
        // state to the snapshot taken at mount. A field flips to true ONLY
        // when the user actually moved it away from the AI's prefill.
        const trimmedTitle = form.title.trim();
        const trimmedSub = form.subcategory.trim();
        const sortedSeasonsKey = [...form.seasons].sort().join('|');
        const aiOverridden = {
          title:
            trimmedTitle.length > 0 && trimmedTitle !== initial.title.trim(),
          category: form.category !== initial.category,
          subcategory: trimmedSub !== initial.subcategory.trim(),
          color_primary: form.primaryColor !== initial.primaryColor,
          color_secondary: form.secondaryColor !== initial.secondaryColor,
          material: form.material !== initial.material,
          fit: form.fit !== initial.fit,
          pattern: form.pattern !== initial.pattern,
          season_tags: sortedSeasonsKey !== initial.seasonsKey,
          formality: form.formality !== initial.formality,
        };

        // Send `undefined` for any picker field the user did NOT touch
        // so `persistGarment` falls back to `analysis.<field>` instead of
        // nulling out a value the analyzer produced.

        const garment = await addGarment.mutateAsync({
          storagePath: resolvedPath,
          analysis,
          source,
          enableStudioQuality,
          price: parsedPrice,
          title: trimmedTitle || analysis.title,
          category: form.category || analysis.category || 'top',
          subcategory: aiOverridden.subcategory
            ? trimmedSub.length > 0
              ? trimmedSub
              : null
            : undefined,
          color_primary: aiOverridden.color_primary
            ? form.primaryColor.length > 0
              ? form.primaryColor
              : null
            : undefined,
          color_secondary: aiOverridden.color_secondary
            ? form.secondaryColor.length > 0
              ? form.secondaryColor
              : null
            : undefined,
          material: aiOverridden.material
            ? form.material.length > 0
              ? form.material
              : null
            : undefined,
          fit: aiOverridden.fit
            ? form.fit.length > 0
              ? form.fit
              : null
            : undefined,
          pattern: aiOverridden.pattern
            ? form.pattern.length > 0
              ? form.pattern
              : null
            : undefined,
          season_tags: aiOverridden.season_tags ? form.seasons : undefined,
          formality: aiOverridden.formality ? form.formality : undefined,
          aiOverridden,
        });
        hapticSuccess();
        trackEvent('addpiece.save', {
          source,
          studio: enableStudioQuality,
          batch: !!batch,
        });
        if (photoUri) markAddPieceCheckpoint(photoUri, 'save', { source });
        // Mark saved BEFORE nav.reset — once the navigator unmounts this
        // screen, the cleanup effect runs synchronously and reads savedRef.
        input.savedRef.current = true;
        // Batch path — flag the item as saved on the pipeline (so its storage
        // object is preserved against the next dropBatch sweep) and either
        // bounce back to Step 2 with the next pending index or wrap up.
        if (batch) {
          markItemSaved(batch.batchId, batch.index);
          const next = nextPendingIndex(batch.batchId, batch.index);
          if (next !== -1) {
            // Replace forward — back stack stays at [..., AddPieceStep1,
            // current batch screen]. `photoUri` and `allUris` are unused on
            // the batch path; the pipeline supplies the uri.
            nav.replace('AddPieceStep2', {
              photoUri: '',
              allUris: [],
              source,
              batch: { ...batch, index: next },
            });
            return;
          }
          dropBatch(batch.batchId);
        }
        nav.reset({
          index: 1,
          routes: [
            { name: 'MainTabs' },
            { name: 'GarmentDetail', params: { id: garment.id } },
          ],
        });
      } catch (err) {
        // Offline queue branch — controlled flow signal.
        if (err instanceof OfflineQueuedError) {
          input.savedRef.current = true;
          if (batch) {
            markItemSaved(batch.batchId, batch.index);
            dropBatch(batch.batchId);
          }
          Alert.alert(
            tr('addpiece.step3.offline.title'),
            tr('addpiece.step3.offline.body'),
          );
          nav.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
        } else {
          Alert.alert(tr('addpiece.step3.saveFailed.title'), friendlySaveError(err));
        }
      } finally {
        savingRef.current = false;
        setIsSaving(false);
        // Codex round 10 P2 — if the user unmounted Step 3 while this save
        // was in flight, the orchestrator's cleanup effect parked a closure
        // here instead of running it. Invoke it now.
        const deferred = input.pendingCleanupRef.current;
        if (deferred) {
          input.pendingCleanupRef.current = null;
          deferred();
        }
      }
    },
    // input is a fresh object every render but its fields are refs / stable
    // route params, so depending on the whole input would trigger handleSave
    // to re-create every render. Pull stable deps explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      nav,
      addGarment,
      getUploadPromise,
      input.storagePath,
      input.uploadId,
      input.photoUri,
      input.analysis,
      input.source,
      input.batch,
    ],
  );

  // Save bar covers both the upload-await window (`isSaving`) and the
  // mutateAsync round-trip (`addGarment.isPending`).
  const saveBusy = isSaving || addGarment.isPending;

  const openSheet = useCallback(() => {
    if (saveBusy) return;
    hapticLight();
    setChoiceOpen(true);
  }, [saveBusy]);

  // Render-prop slot — orchestrator includes `saveFlowElement` in its JSX.
  const saveFlowElement = (
    <GarmentSaveChoiceSheet
      open={choiceOpen}
      isSaving={saveBusy}
      onClose={() => setChoiceOpen(false)}
      onSelectStudio={() => void handleSave(true)}
      onSelectOriginal={() => void handleSave(false)}
    />
  );

  return { saveBusy, openSheet, saveFlowElement, savingRef };
}

// Imperative-handle export for tests / future render-prop consumers. Not used
// by the orchestrator today (the hook return is enough), but kept for parity
// with the spec's "AddPieceStep3SaveFlow.tsx — owns save mutation + ... +
// save-choice sheet" component-shaped surface.
export const AddPieceStep3SaveFlow = React.forwardRef<
  SaveFlowHandle,
  AddPieceStep3SaveFlowInput & {
    onSaveBusyChange?: (busy: boolean) => void;
  }
>(function AddPieceStep3SaveFlowImpl(props, ref) {
  const { onSaveBusyChange, ...input } = props;
  const { saveBusy, openSheet, saveFlowElement } = useAddPieceStep3SaveFlow(input);
  useImperativeHandle(ref, () => ({ openSheet }), [openSheet]);
  React.useEffect(() => {
    onSaveBusyChange?.(saveBusy);
  }, [saveBusy, onSaveBusyChange]);
  return saveFlowElement;
});
