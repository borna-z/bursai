// Import from link — M20 entry surface.
//
// Flow: paste one-or-more https:// product URLs (one per line) → "Find
// pieces" → useImportFromLinks streams per-URL progress → success rows
// link to the saved garment in GarmentDetail; failed rows surface the
// scrape reason inline ("No image found", "Already imported", etc.).
//
// **Why no separate "confirm" step:** the deployed
// `import_garments_from_links` edge function commits the garment row
// before returning (image download → Storage upload → garments INSERT),
// so there is no proposal to confirm client-side. The screen mirrors
// the web `LinkImportForm.tsx` UX: paste → import progress → tap a
// success row to refine fields in GarmentDetail.
//
// Subscription gating: `useImportFromLinks` surfaces the
// `'subscription_required'` sentinel via `error`; first occurrence
// routes to PaywallScreen (M19 sticky-ref pattern).
//
// Route: `ImportFromLink`. Optional `initialUrl` param prefills the
// textarea — reserved for a future iOS Share Extension hand-off
// (deferred per the wave file).

import React from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Button } from '../components/Button';
import { Caption } from '../components/Caption';
import { Eyebrow } from '../components/Eyebrow';
import { IconBtn } from '../components/IconBtn';
import { PageTitle } from '../components/PageTitle';
import { Spinner } from '../components/Spinner';
import { BackIcon } from '../components/icons';
import {
  parseUrlList,
  useImportFromLinks,
  type ImportItem,
  MAX_LINKS_PER_BATCH,
} from '../hooks/useImportFromLinks';
import { useSignedUrl } from '../hooks/useSignedUrl';
import { hapticLight } from '../lib/haptics';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ImportFromLink'>;

const SUBSCRIPTION_SENTINEL = 'subscription_required';
const INVALID_URL_SENTINEL = 'invalid_url';

export function ImportFromLinkScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const initialUrl = route.params?.initialUrl ?? '';

  const [linksText, setLinksText] = React.useState<string>(initialUrl);

  const importHook = useImportFromLinks();
  const { items, isImporting, currentIndex, totalCount, error, submit, reset } = importHook;

  // Sticky paywall redirect — mirrors VisualSearchScreen's pattern. The
  // hook surfaces `'subscription_required'` via `error`; first time we
  // see it, route to Paywall and let the next error transition reset
  // the sticky ref.
  const paywallRoutedRef = React.useRef(false);
  React.useEffect(() => {
    if (error === SUBSCRIPTION_SENTINEL) {
      if (!paywallRoutedRef.current) {
        paywallRoutedRef.current = true;
        reset();
        nav.navigate('Paywall');
      }
      return;
    }
    paywallRoutedRef.current = false;
  }, [error, nav, reset]);

  const parsedUrls = React.useMemo(() => parseUrlList(linksText), [linksText]);
  const linkCount = parsedUrls.length;
  const overMax = linkCount > MAX_LINKS_PER_BATCH;
  const hasResults = items.length > 0;
  const successCount = items.filter((it) => it.status === 'success').length;
  const failedCount = items.filter((it) => it.status === 'failed').length;
  const allDone = !isImporting && hasResults && successCount + failedCount === items.length;

  const handleSubmit = React.useCallback(() => {
    if (linkCount === 0 || isImporting) return;
    hapticLight();
    void submit(parsedUrls);
  }, [linkCount, isImporting, submit, parsedUrls]);

  // Tap a success row → open the saved garment in GarmentDetail so the
  // user can refine the auto-defaults (category 'top', color 'grey').
  const openGarment = React.useCallback(
    (garmentId: string | undefined) => {
      if (!garmentId || garmentId.length === 0) return;
      hapticLight();
      nav.navigate('GarmentDetail', { id: garmentId });
    },
    [nav],
  );

  const onBack = React.useCallback(() => {
    if (isImporting) {
      Alert.alert(tr('importFromLink.cancelTitle'), tr('importFromLink.cancelBody'), [
        { text: tr('importFromLink.cancelStay'), style: 'cancel' },
        {
          text: tr('importFromLink.cancelLeave'),
          style: 'destructive',
          onPress: () => {
            reset();
            nav.goBack();
          },
        },
      ]);
      return;
    }
    nav.goBack();
  }, [isImporting, nav, reset]);

  // ─── error → caption copy ────────────────────────────────────────
  let inlineErrorCopy: string | null = null;
  if (error === INVALID_URL_SENTINEL) {
    inlineErrorCopy = tr('importFromLink.error.invalidUrl');
  } else if (error && error !== SUBSCRIPTION_SENTINEL) {
    // Generic network / circuit / rate-limit copy — the hook routes
    // 402 to the paywall sticky-ref above; everything else surfaces
    // here as a single inline caption. Per-URL failure detail lives on
    // each ImportItem.error and is rendered inside the row.
    inlineErrorCopy = tr('importFromLink.error.network');
  }

  if (!inlineErrorCopy && allDone && successCount === 0) {
    // A batch where every URL failed scrape — surface the aggregate
    // copy so the user has a clear next step (try other URLs / check
    // the source site).
    inlineErrorCopy = tr('importFromLink.error.noResults');
  }

  const ctaLabel = (() => {
    if (isImporting) {
      return tr('importFromLink.searching').replace('{current}', String(currentIndex)).replace(
        '{total}',
        String(totalCount),
      );
    }
    if (overMax) {
      return tr('importFromLink.maxLinks').replace('{max}', String(MAX_LINKS_PER_BATCH));
    }
    return tr('importFromLink.cta');
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={onBack} ariaLabel={tr('importFromLink.back')}>
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{tr('importFromLink.eyebrow')}</Eyebrow>
          <PageTitle size={26}>{tr('importFromLink.title')}</PageTitle>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: hasResults ? 8 : 0 }}>
            {/* ============ INPUT ============ */}
            <View style={{ gap: 6 }}>
              <View style={s.labelRow}>
                <Eyebrow>{tr('importFromLink.inputLabel')}</Eyebrow>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 10,
                    letterSpacing: 1.4,
                    color: overMax ? t.destructive : t.fg2,
                    textTransform: 'uppercase',
                  }}>
                  {linkCount}/{MAX_LINKS_PER_BATCH}
                </Text>
              </View>
              <TextInput
                value={linksText}
                onChangeText={setLinksText}
                placeholder={tr('importFromLink.placeholder')}
                placeholderTextColor={t.fg3}
                multiline
                editable={!isImporting}
                autoCorrect={false}
                autoCapitalize="none"
                keyboardType="url"
                textContentType="URL"
                accessibilityLabel={tr('importFromLink.inputLabel')}
                style={[
                  s.textInput,
                  {
                    borderColor: overMax ? t.destructive : t.border,
                    backgroundColor: t.card,
                    color: t.fg,
                  },
                ]}
              />
              <Caption>{tr('importFromLink.inputHint')}</Caption>
            </View>

            {inlineErrorCopy ? (
              <Text
                style={{
                  fontFamily: fonts.ui,
                  fontSize: 12,
                  color: t.destructive,
                  lineHeight: 17,
                }}>
                {inlineErrorCopy}
              </Text>
            ) : null}

            {/* ============ CTA ============ */}
            <Button
              label={ctaLabel}
              onPress={handleSubmit}
              disabled={isImporting || linkCount === 0 || overMax}
              accessibilityLabel={ctaLabel}
              accessibilityState={{ busy: isImporting, disabled: isImporting || linkCount === 0 || overMax }}
            />

            {hasResults ? (
              <Eyebrow style={{ marginTop: 8 }}>{tr('importFromLink.resultsHeading')}</Eyebrow>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <ImportRow item={item} onOpen={() => openGarment(item.garment_id)} />
        )}
        ListEmptyComponent={null}
        ListFooterComponent={
          allDone ? (
            <View style={{ marginTop: 12, gap: 4 }}>
              <Caption style={{ textAlign: 'center' }}>
                {tr('importFromLink.allDone')
                  .replace('{success}', String(successCount))
                  .replace('{failed}', String(failedCount))}
              </Caption>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

// ─── per-row UI ────────────────────────────────────────────────────────

interface ImportRowProps {
  item: ImportItem;
  onOpen: () => void;
}

function ImportRow({ item, onOpen }: ImportRowProps) {
  const t = useTokens();
  const isSuccess = item.status === 'success';
  const isFailed = item.status === 'failed';
  const isImporting = item.status === 'importing';

  // Try to render the saved thumbnail for success rows. The function
  // uploads to the `garments` bucket so `useSignedUrl` picks the row up
  // through the same cache as the wardrobe surfaces. Pass `null` for
  // non-success rows so the query is disabled.
  const signedUrlQuery = useSignedUrl(isSuccess ? item.image_path ?? null : null);
  const thumbUri = signedUrlQuery.data ?? null;

  let displayHost = item.url;
  try {
    displayHost = new URL(item.url).hostname;
  } catch {
    /* keep raw URL */
  }

  let statusLabel: string;
  let statusColor: string;
  let statusBg: string;
  if (isSuccess) {
    statusLabel = tr('importFromLink.statusSuccess');
    statusColor = t.accent;
    statusBg = t.accentSoft;
  } else if (isFailed) {
    statusLabel = tr('importFromLink.statusFailed');
    statusColor = t.destructive;
    statusBg = t.destructiveSoft;
  } else if (isImporting) {
    statusLabel = tr('importFromLink.statusImporting');
    statusColor = t.fg2;
    statusBg = t.bg2;
  } else {
    statusLabel = tr('importFromLink.statusWaiting');
    statusColor = t.fg3;
    statusBg = t.bg2;
  }

  const Container: typeof Pressable = Pressable;
  return (
    <Container
      accessibilityRole={isSuccess ? 'button' : 'text'}
      accessibilityLabel={
        isSuccess
          ? tr('importFromLink.openGarmentLabel').replace('{title}', item.title ?? displayHost)
          : statusLabel
      }
      accessibilityHint={isSuccess ? tr('importFromLink.openGarmentHint') : undefined}
      disabled={!isSuccess}
      onPress={isSuccess ? onOpen : undefined}
      style={({ pressed }) => [
        s.row,
        {
          borderColor: t.border,
          backgroundColor: t.card,
          opacity: isSuccess && pressed ? 0.85 : 1,
        },
      ]}>
      {/* Thumbnail — tints by hue for unloaded states. Surfaces the
          actual image once useSignedUrl resolves. */}
      <View style={[s.thumb, { borderColor: t.border, backgroundColor: t.bg2 }]}>
        {thumbUri ? (
          <Image
            source={{ uri: thumbUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : isImporting ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Spinner />
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 14,
            color: t.fg,
            fontWeight: '600',
            letterSpacing: -0.14,
          }}>
          {item.title ?? displayHost}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.ui, fontSize: 11, color: t.fg2 }}>
          {displayHost}
        </Text>
        {isFailed && item.error ? (
          <Text
            numberOfLines={2}
            style={{
              fontFamily: fonts.ui,
              fontSize: 11,
              color: t.destructive,
              marginTop: 2,
            }}>
            {item.error}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          s.statusBadge,
          { backgroundColor: statusBg, borderColor: statusColor },
        ]}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 9.5,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: statusColor,
          }}>
          {statusLabel}
        </Text>
      </View>
    </Container>
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textInput: {
    minHeight: 140,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
