// Add piece — Step 3 of 3 (review + save).
//
// Phase 6 orchestrator. The picker form lives in `./AddPieceStep3/AddPieceStep3Form`
// and the save mutation + cleanup-refs + choice sheet live in
// `./AddPieceStep3/AddPieceStep3SaveFlow`. This file owns:
//   - Navigation / header / hero preview / sticky save bar.
//   - The unmount cleanup effect (delete orphan storage objects on back-out).
//     The cleanup MUST stay here — it captures route params at mount and runs
//     when the screen unmounts; the save-flow hook coordinates with it via
//     `savedRef` + `pendingCleanupRef`.
//   - `useDetectDuplicate` + the duplicate-warning modal. Per the design spec
//     this hook stays at the orchestrator level — it is the source of truth
//     for the duplicate UI and the form is intentionally unaware.
//   - The live form-state ref that the save flow reads on submit.
//
// Wiring (W5 → R-C.3): receives { storagePath, photoUri, analysis } from Step
// 2 and lets the user review the AI-detected fields before saving.
//   • Hero shows the local photoUri (no signed-URL round-trip — the file is
//     right there); swaps to the masked WebP cutout once it lands.
//   • Save → `useAddPieceStep3SaveFlow.handleSave` → nav.reset to GarmentDetail.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { BackIcon } from '../components/icons';
import { useDetectDuplicate, topDuplicate } from '../hooks/useDetectDuplicate';
import { useSignedUrl } from '../hooks/useSignedUrl';
import { t as tr } from '../lib/i18n';
import { hapticLight } from '../lib/haptics';
import { deleteUpload, peekUploadMaskMetadata } from '../lib/imageUpload';
import {
  CATEGORIES,
  MATERIALS,
  FITS,
  PATTERNS,
  matchCanonical,
} from '../lib/garmentTaxonomy';
import {
  dropPendingUpload,
  takePendingUpload,
  type PendingUploadPromise,
} from '../lib/pendingUpload';
import {
  dropBatch,
  markItemSkipped,
} from '../lib/batchPipeline';
import { trackEvent, markAddPieceCheckpoint } from '../lib/analytics';
import type { RootStackParamList } from '../navigation/RootNavigator';

import { AddPieceStep3Form } from './AddPieceStep3/AddPieceStep3Form';
import { AddPieceStep3Hero } from './AddPieceStep3/AddPieceStep3Hero';
import { AddPieceStep3DuplicateModal } from './AddPieceStep3/AddPieceStep3DuplicateModal';
import { useAddPieceStep3SaveFlow } from './AddPieceStep3/AddPieceStep3SaveFlow';
import type { GarmentFormState } from './AddPieceStep3/garmentMetadataForm.types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AddPieceStep3'>;

// Tiny debounce hook — throttles the title input feeding the duplicate
// detection query so per-keystroke edits don't burn the
// `detect_duplicate_garment` 8/min rate limit. Inlined here because it's
// the only consumer.
function useDebouncedTitle(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

// Build the initial form state from the analyzer prefill. Out-of-canonical
// values default to '' so the user is prompted to pick something the
// wardrobe filters recognise (mirrors the legacy useState initialisers).
function buildInitialFormState(
  analysis: Route['params']['analysis'] | undefined,
): GarmentFormState {
  const category = (() => {
    const m = matchCanonical(analysis?.category, CATEGORIES);
    return typeof m === 'string' && (CATEGORIES as readonly string[]).includes(m)
      ? (m as GarmentFormState['category'])
      : '';
  })();
  const material = (() => {
    const m = matchCanonical(analysis?.material, MATERIALS);
    return typeof m === 'string' && (MATERIALS as readonly string[]).includes(m)
      ? (m as GarmentFormState['material'])
      : '';
  })();
  const fit = (() => {
    const m = matchCanonical(analysis?.fit, FITS);
    return typeof m === 'string' && (FITS as readonly string[]).includes(m)
      ? (m as GarmentFormState['fit'])
      : '';
  })();
  const pattern = (() => {
    const m = matchCanonical(analysis?.pattern, PATTERNS);
    return typeof m === 'string' && (PATTERNS as readonly string[]).includes(m)
      ? (m as GarmentFormState['pattern'])
      : '';
  })();
  const formality = ((): GarmentFormState['formality'] => {
    const f = analysis?.formality;
    return f === 1 || f === 2 || f === 3 || f === 4 || f === 5
      ? (f as 1 | 2 | 3 | 4 | 5)
      : null;
  })();
  return {
    title: analysis?.title ?? '',
    category,
    subcategory: analysis?.subcategory ?? '',
    primaryColor: analysis?.color_primary ?? '',
    secondaryColor: analysis?.color_secondary ?? '',
    material,
    fit,
    pattern,
    seasons: analysis?.season_tags ?? [],
    formality,
  };
}

export function AddPieceStep3() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const params = route.params;

  // ---- Form state (lives at the orchestrator so the duplicate query and the
  // save flow share one source of truth). The form component receives the
  // initial snapshot + an onChange that updates this state.
  const initialForm = useMemo(
    () => buildInitialFormState(params?.analysis),
    [params?.analysis],
  );
  const [formState, setFormState] = useState<GarmentFormState>(initialForm);
  // Live snapshot ref — the save flow reads the latest picker values at the
  // moment of submission without re-rendering. Mirrors the legacy direct
  // state reads inside `handleSave`.
  const formStateRef = useRef(formState);
  useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // ---- Snapshot of the picker state at first mount. Compared in the save
  // flow to compute the `ai_overridden` map (per-field "did the user touch
  // this away from the AI's prefill"). Mirrors the legacy
  // `initialPickersRef`.
  const initialSnapshotRef = useRef({
    title: initialForm.title,
    category: initialForm.category,
    subcategory: initialForm.subcategory,
    primaryColor: initialForm.primaryColor,
    secondaryColor: initialForm.secondaryColor,
    material: initialForm.material,
    fit: initialForm.fit,
    pattern: initialForm.pattern,
    seasonsKey: [...initialForm.seasons].sort().join('|'),
    formality: initialForm.formality,
  });

  // ---- Cleanup refs shared with the save flow. See the per-ref comments on
  // the legacy implementation for the full story — these stay at the
  // orchestrator level because the unmount effect below captures route
  // params at mount and must coordinate with the save handler's finally.
  const uploadPromiseRef = useRef<PendingUploadPromise | null>(null);
  const savedRef = useRef(false);
  const pendingCleanupRef = useRef<(() => void) | null>(null);
  // Saving-in-flight signal that the unmount cleanup consults. The save-flow
  // hook updates this on every render via `saveFlow.saveBusy` (assigned below
  // the hook call). Declared here so the unmount effect closure can read it
  // by reference.
  const saveFlowSavingRef = useRef(false);

  // ---- Hero preview state. The masked WebP sidecar lands a few hundred ms
  // after the raw upload; stash its storage path so we can swap from the
  // local `photoUri` to the BG-removed cutout once it's available. Falling
  // back to `photoUri` while the mask is in flight keeps the screen useful
  // immediately.
  const [resolvedStoragePath, setResolvedStoragePath] = useState<string | null>(
    () => params?.storagePath ?? null,
  );
  const [maskedStoragePath, setMaskedStoragePath] = useState<string | null>(
    () =>
      params?.storagePath
        ? peekUploadMaskMetadata(params.storagePath)?.maskedStoragePath ?? null
        : null,
  );
  useEffect(() => {
    if (params?.storagePath || !params?.uploadId) return;
    if (!uploadPromiseRef.current) {
      const promise = takePendingUpload(params.uploadId);
      if (!promise) return;
      uploadPromiseRef.current = promise;
    }
    let cancelled = false;
    uploadPromiseRef.current
      .then((res) => {
        if (cancelled) return;
        setResolvedStoragePath(res.storagePath);
        setMaskedStoragePath(res.maskedStoragePath ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [params?.uploadId, params?.storagePath]);

  const { data: maskedSignedUrl } = useSignedUrl(maskedStoragePath);

  // ---- Unmount cleanup. Drop any pending-upload entry the user never
  // consumed and best-effort delete the storage object if it had already
  // landed. Without this a back-out / re-scan / nav.reset-without-save would
  // leave the entry in the module map for the app's lifetime AND leak a
  // JPEG in the user's bucket.
  useEffect(() => {
    const uploadId = params?.uploadId;
    const directStoragePath = params?.storagePath ?? null;
    const batchOnMount = params?.batch ?? null;
    const batchIndex = batchOnMount?.index ?? null;
    return () => {
      const runCleanup = () => {
        // savedRef.current is intentionally read at cleanup time (not
        // captured) — the save flow flips it true on success / offline-queue,
        // and the cleanup must observe the final value to skip the orphan
        // delete. Eslint's "ref will likely have changed" heuristic is the
        // wrong call here; the legacy implementation followed the same
        // pattern.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        if (savedRef.current) return;
        if (batchOnMount && batchIndex !== null) {
          markItemSkipped(batchOnMount.batchId, batchIndex);
          dropBatch(batchOnMount.batchId);
          return;
        }
        let promise = uploadPromiseRef.current;
        if (!promise && uploadId) {
          promise = takePendingUpload(uploadId) ?? null;
        } else if (uploadId) {
          dropPendingUpload(uploadId);
        }
        if (promise) {
          promise.then((res) => deleteUpload(res.storagePath)).catch(() => {});
        } else if (directStoragePath) {
          void deleteUpload(directStoragePath);
        }
      };
      // Codex round 10 P2 on PR #725 — defer cleanup if a save is in flight.
      // The save flow's finally consults `pendingCleanupRef` and invokes the
      // deferred closure after `savingRef` clears, so the cleanup observes
      // the final `savedRef` value.
      if (saveFlowSavingRef.current) {
        pendingCleanupRef.current = runCleanup;
        return;
      }
      runCleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- form_ready analytics checkpoint.
  useEffect(() => {
    trackEvent('addpiece.form.ready', {
      source: params?.source ?? 'unknown',
      has_storage_path: !!params?.storagePath,
      has_upload_promise: !!params?.uploadId,
    });
    if (params?.photoUri) {
      markAddPieceCheckpoint(params.photoUri, 'form_ready', { source: params?.source ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Save-flow hook. Owns the mutation, the reentrancy guard, the choice
  // sheet, and the batch / offline branches. Returns the busy state for the
  // sticky save bar plus the choice sheet JSX.
  //
  // Constructed lazily-stable: the hook reads route params + refs through the
  // input object, so passing fresh closure / ref identities every render is
  // fine — the internal `useCallback` depends on the underlying values.
  const saveFlow = useAddPieceStep3SaveFlow({
    storagePath: params?.storagePath ?? null,
    uploadId: params?.uploadId,
    photoUri: params?.photoUri ?? '',
    analysis: params?.analysis ?? ({} as Route['params']['analysis']),
    source: params?.source ?? 'add_photo',
    batch: params?.batch,
    getFormState: () => formStateRef.current,
    initialSnapshot: initialSnapshotRef.current,
    uploadPromiseRef,
    savedRef,
    pendingCleanupRef,
  });
  // Mirror the hook's busy state into the saving-in-flight ref so the
  // unmount cleanup above can consult it without subscribing.
  saveFlowSavingRef.current = saveFlow.saveBusy;

  // ---- Duplicate detection. Hooks must run unconditionally above the
  // no-params bail-out below; optional-chained reads handle the null-params
  // first render.
  const debouncedDuplicateTitle = useDebouncedTitle(
    formState.title.trim() || (params?.analysis.title ?? ''),
    600,
  );

  // Mirror handleSave's aiOverridden gate so the duplicate probe sees exactly
  // what will persist. Three cases per field:
  //   1) untouched (current === initial snapshot) → analyzer value
  //   2) touched + non-empty → the picker value
  //   3) touched + cleared to '' → null
  const duplicateInput = useMemo(
    () => {
      if (!params?.analysis || saveFlow.saveBusy) return null;
      const initial = initialSnapshotRef.current;
      const trimmedSub = formState.subcategory.trim();
      const trimmedInitialSub = initial.subcategory.trim();
      const effective = <T extends string | null | undefined>(
        touched: boolean,
        value: string,
        fallback: T,
      ) => (touched ? (value.length > 0 ? value : null) : fallback ?? null);
      return {
        image_path: resolvedStoragePath,
        category: formState.category || params.analysis.category || null,
        color_primary: effective(
          formState.primaryColor !== initial.primaryColor,
          formState.primaryColor,
          params.analysis.color_primary,
        ),
        title: debouncedDuplicateTitle || params.analysis.title,
        subcategory: effective(
          trimmedSub !== trimmedInitialSub,
          trimmedSub,
          params.analysis.subcategory,
        ),
        material: effective(
          formState.material !== initial.material,
          formState.material,
          params.analysis.material,
        ),
      };
    },
    [
      resolvedStoragePath,
      params?.analysis,
      debouncedDuplicateTitle,
      formState.category,
      formState.primaryColor,
      formState.subcategory,
      formState.material,
      saveFlow.saveBusy,
    ],
  );
  const duplicateQuery = useDetectDuplicate(duplicateInput);
  const duplicateMatch = topDuplicate(duplicateQuery.data);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const duplicateAcknowledgedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!duplicateMatch) return;
    if (saveFlow.saveBusy) return;
    if (duplicateAcknowledgedRef.current === duplicateMatch.garment_id) return;
    setDuplicateModalOpen(true);
  }, [duplicateMatch, saveFlow.saveBusy]);

  // ---- Defensive guard for the no-params render. Hooks above run first;
  // this bail-out is safe because every hook is unconditional.
  if (!params) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
        <View style={s.fallback}>
          <Text style={{ fontFamily: fonts.ui, color: t.fg }}>{tr('addpiece.step3.fallback.body')}</Text>
          <Button label={tr('addpiece.step3.fallback.startOver')} onPress={() => nav.navigate('AddPieceStep1')} />
        </View>
      </SafeAreaView>
    );
  }

  const { photoUri, analysis } = params;

  const dismissDuplicate = (acknowledge: boolean) => {
    if (acknowledge && duplicateMatch) {
      duplicateAcknowledgedRef.current = duplicateMatch.garment_id;
    }
    setDuplicateModalOpen(false);
  };

  const onViewExistingDuplicate = () => {
    if (!duplicateMatch) return;
    hapticLight();
    dismissDuplicate(true);
    if (params?.batch) {
      markItemSkipped(params.batch.batchId, params.batch.index);
      dropBatch(params.batch.batchId);
    }
    nav.reset({
      index: 1,
      routes: [
        { name: 'MainTabs' },
        { name: 'GarmentDetail', params: { id: duplicateMatch.garment_id } },
      ],
    });
  };

  const onAddAnyway = () => {
    hapticLight();
    dismissDuplicate(true);
  };

  const handleRescan = () => {
    hapticLight();
    if (params?.batch) {
      markItemSkipped(params.batch.batchId, params.batch.index);
      dropBatch(params.batch.batchId);
    }
    nav.navigate('AddPieceStep1');
  };

  const confirmBack = () => {
    if (!params?.analysis) {
      nav.goBack();
      return;
    }
    const onDiscard = () => {
      if (params?.batch) {
        markItemSkipped(params.batch.batchId, params.batch.index);
        dropBatch(params.batch.batchId);
        nav.navigate('MainTabs');
        return;
      }
      nav.goBack();
    };
    Alert.alert(
      tr('addpiece.step3.discard.title'),
      tr('addpiece.step3.discard.body'),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        { text: tr('common.discard'), style: 'destructive', onPress: onDiscard },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={confirmBack} ariaLabel={tr('common.back')}>
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{tr('addpiece.step3.headerEyebrow')}</Eyebrow>
          <PageTitle size={26}>{tr('addpiece.step3.headerTitle')}</PageTitle>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('addpiece.step3.rescan.aria')}
          onPress={handleRescan}
          style={{ paddingHorizontal: 6, paddingVertical: 8 }}>
          <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.accent, fontWeight: '500' }}>
            {tr('addpiece.step3.rescan')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 14 }}
        showsVerticalScrollIndicator={false}>
        <AddPieceStep3Hero
          photoUri={photoUri}
          maskedSignedUrl={maskedSignedUrl}
          title={analysis.title}
          category={analysis.category}
          colorPrimary={analysis.color_primary}
          confidence={analysis.confidence}
        />
        <AddPieceStep3Form initial={initialForm} onChange={setFormState} />
      </ScrollView>

      {/* ============ STICKY SAVE BAR ============ */}
      <View style={[s.stickyBar, { borderTopColor: t.border, backgroundColor: t.bg }]}>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{tr('addpiece.step3.almostEyebrow')}</Eyebrow>
          <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: t.fg2, letterSpacing: -0.11 }}>
            {tr('addpiece.step3.almostBody')}
          </Text>
        </View>
        <Button
          label={saveFlow.saveBusy ? tr('addpiece.step3.saving') : tr('addpiece.step3.save')}
          onPress={saveFlow.openSheet}
          disabled={saveFlow.saveBusy}
          accessibilityLabel={saveFlow.saveBusy ? tr('addpiece.step3.saving.aria') : tr('addpiece.step3.save.aria')}
          accessibilityState={{ busy: saveFlow.saveBusy, disabled: saveFlow.saveBusy }}
        />
      </View>

      {saveFlow.saveFlowElement}

      <AddPieceStep3DuplicateModal
        visible={duplicateModalOpen && !!duplicateMatch && !saveFlow.saveBusy}
        matchTitle={duplicateMatch?.title}
        onClose={() => dismissDuplicate(false)}
        onViewExisting={onViewExistingDuplicate}
        onAddAnyway={onAddAnyway}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
});
