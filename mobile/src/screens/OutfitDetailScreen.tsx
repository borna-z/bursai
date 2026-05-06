// Outfit detail — opened from OutfitsScreen, HomeScreen Today's Look, or any inline outfit card.
// Sections (top→bottom): header (back · eyebrow · italic title · share + more) · 2x2 garment thumb
// grid · meta chips row · primary actions row (Wear today / Restyle / Save) · feedback section
// (5-star rating + notes input) · pieces horizontal scroll. Sticky header is via SafeAreaView;
// the body uses a KeyboardAvoidingView so the notes input doesn't get clipped on iOS.
//
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx OutfitDetailScreen + the README "Outfit
// detail" section. Data is a fixture; route param `id` is parsed and passed to a future hook.

import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { BackIcon, MoreIcon, ShareIcon, StarIcon } from '../components/icons';
import {
  useOutfit,
  useMarkOutfitWorn,
  useSaveOutfit,
  useDeleteOutfit,
  useRateOutfit,
  useOutfitFeedback,
  useSaveOutfitNote,
} from '../hooks/useOutfits';
import { t as tr } from '../lib/i18n';
import { useUpsertPlannedOutfit } from '../hooks/usePlannedOutfits';
import { useSignedUrl } from '../hooks/useSignedUrl';
import { localISODate, outfitDisplayName, outfitGradientHue } from '../lib/outfitDisplay';
import type { OutfitItemWithGarment, OutfitWithItems } from '../types/outfit';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'OutfitDetail'>;

export function OutfitDetailScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const id = route.params?.id;

  const outfitQ = useOutfit(id);
  const outfit = outfitQ.data ?? null;

  const markWorn = useMarkOutfitWorn();
  const saveOutfit = useSaveOutfit();
  const deleteOutfit = useDeleteOutfit();
  const rateOutfit = useRateOutfit();
  const upsertPlanned = useUpsertPlannedOutfit();
  const feedbackQ = useOutfitFeedback(outfit?.id);
  const saveNote = useSaveOutfitNote();

  const [rating, setRating] = React.useState(0);
  const [notes, setNotes] = React.useState('');

  // Hydrate rating + notes from outfit + outfit_feedback so a returning user
  // sees their prior values instead of an empty 5-star row + empty note that
  // a careless tap or save would overwrite. Audit K (rating) and L (notes).
  // Only seed once per outfit id — local edits win after the initial seed.
  const hydratedForId = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!outfit?.id || feedbackQ.isLoading) return;
    if (hydratedForId.current === outfit.id) return;
    hydratedForId.current = outfit.id;
    const seedRating =
      feedbackQ.data?.rating ??
      (typeof outfit.rating === 'number' ? outfit.rating : 0);
    setRating(seedRating ?? 0);
    setNotes(feedbackQ.data?.commentary ?? '');
  }, [outfit?.id, outfit?.rating, feedbackQ.data, feedbackQ.isLoading]);

  const persistedNote = feedbackQ.data?.commentary ?? '';
  const notesDirty = notes.trim() !== persistedNote.trim();

  const wornToday = React.useMemo(() => {
    if (!outfit?.worn_at) return false;
    const wornDate = new Date(outfit.worn_at);
    if (Number.isNaN(wornDate.getTime())) return false;
    return localISODate(wornDate) === localISODate(new Date());
  }, [outfit?.worn_at]);

  const isSaved = Boolean(outfit?.saved);

  const handleWear = React.useCallback(() => {
    if (!outfit) return;
    const garmentIds = (outfit.outfit_items ?? [])
      .map((item) => item.garment?.id)
      .filter((id): id is string => Boolean(id));
    markWorn.mutate(
      { outfitId: outfit.id, garmentIds },
      {
        onSuccess: () => Alert.alert('Marked worn', 'Saved to your wear log.'),
        onError: (err: unknown) =>
          Alert.alert(
            'Could not mark worn',
            err instanceof Error ? err.message : 'Please try again.',
          ),
      },
    );
  }, [outfit, markWorn]);

  const handleSaveToggle = React.useCallback(() => {
    if (!outfit || isSaved || saveOutfit.isPending) return;
    // Pass the outfit's garment roster so the Style Memory signal carries
    // garment_ids — the ingest_memory_event RPC needs the array (≥2
    // entries) to update positive pair-memory weight on a save.
    const garmentIds =
      outfit.outfit_items
        ?.map((it) => it.garment?.id)
        .filter((id): id is string => typeof id === 'string') ?? [];
    saveOutfit.mutate(
      { outfitId: outfit.id, garmentIds },
      {
        onError: (err: unknown) =>
          Alert.alert(
            'Could not save',
            err instanceof Error ? err.message : 'Please try again.',
          ),
      },
    );
  }, [outfit, isSaved, saveOutfit]);

  const handleAddToPlan = React.useCallback(() => {
    if (!outfit) return;
    upsertPlanned.mutate(
      { date: localISODate(new Date()), outfitId: outfit.id },
      {
        onSuccess: () => Alert.alert('Added', 'Outfit added to today\'s plan.'),
        onError: (err: unknown) =>
          Alert.alert(
            'Could not add to plan',
            err instanceof Error ? err.message : 'Please try again.',
          ),
      },
    );
  }, [outfit, upsertPlanned]);

  const handleDelete = React.useCallback(() => {
    if (!outfit) return;
    Alert.alert('Delete', 'Delete this outfit? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteOutfit.mutate(outfit.id, {
            onSuccess: () => nav.goBack(),
            onError: (err: unknown) =>
              Alert.alert(
                'Could not delete',
                err instanceof Error ? err.message : 'Please try again.',
              ),
          });
        },
      },
    ]);
  }, [outfit, deleteOutfit, nav]);

  const handleRate = React.useCallback(
    (n: number) => {
      // Gate on isPending so a quick double-tap on adjacent stars can't
      // fire two concurrent mutations and create duplicate
      // `outfit_feedback` rows. The hook's defensive sweep collapses
      // duplicates if they slip through, but preventing them at the
      // screen layer is the cheaper first line of defence (Codex P2
      // round 8 on PR #738).
      if (rateOutfit.isPending) return;
      const next = n === rating ? 0 : n;
      setRating(next);
      if (!outfit) return;
      rateOutfit.mutate({ outfitId: outfit.id, rating: next });
    },
    [outfit, rating, rateOutfit],
  );

  if (outfitQ.isLoading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!outfit) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>Outfit</Eyebrow>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 }}>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 22,
              color: t.fg,
              textAlign: 'center',
              letterSpacing: -0.22,
            }}>
            Outfit not found
          </Text>
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: 13,
              color: t.fg2,
              textAlign: 'center',
              lineHeight: 19,
            }}>
            This look may have been removed. Go back and pick another.
          </Text>
          <Button label="Back" variant="outline" onPress={() => nav.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const name = outfitDisplayName(outfit);
  const kicker = wornToday ? 'Worn today' : isSaved ? 'Saved look' : 'Outfit';
  // Schema has no per-outfit wear-count column. Until wear_logs aggregation
  // lands, render a binary "Worn"/"Never worn" instead of the misleading
  // "1 wear" that never increments past 1. Audit G on PR #718.
  const everWorn = Boolean(outfit.worn_at);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>Outfit</Eyebrow>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 18,
                lineHeight: 22,
                fontWeight: '500',
                color: t.fg,
                letterSpacing: -0.18,
              }}>
              {name}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <IconBtn
              ariaLabel="Share outfit"
              variant="ghost"
              onPress={() => nav.navigate('ShareOutfit', { id: outfit.id })}>
              <ShareIcon color={t.fg} />
            </IconBtn>
            <IconBtn
              ariaLabel="More options"
              variant="ghost"
              onPress={() =>
                Alert.alert('Options', undefined, [
                  { text: 'Add to plan', onPress: handleAddToPlan },
                  { text: 'Share outfit', onPress: () => nav.navigate('ShareOutfit', { id: outfit.id }) },
                  { text: 'Delete outfit', style: 'destructive', onPress: handleDelete },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }>
              <MoreIcon color={t.fg} />
            </IconBtn>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 18 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View>
            <Eyebrow style={{ marginBottom: 4 }}>{kicker}</Eyebrow>
            <PageTitle>{name}</PageTitle>
          </View>

          <DetailThumbGrid outfit={outfit} />

          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {outfit.occasion ? <MetaChip label={outfit.occasion} /> : null}
            {outfit.style_vibe ? <MetaChip label={outfit.style_vibe} /> : null}
            {outfit.confidence_level ? <MetaChip label={outfit.confidence_level} /> : null}
            <MetaChip label={everWorn ? 'Worn' : 'Never worn'} />
          </View>

          {outfit.explanation ? (
            <Text style={{ fontFamily: fonts.ui, fontSize: 13, lineHeight: 19.5, color: t.fg2 }}>
              {outfit.explanation}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              // Disable when already worn today so a stray re-tap doesn't
              // re-fire the mutation chain (extra wear_log row, extra
              // wear_count bump on every garment). Audit J on PR #718.
              label={wornToday ? 'Worn today' : 'Wear today'}
              variant={wornToday ? 'accent' : 'primary'}
              block
              style={{ flex: 1 }}
              onPress={handleWear}
              disabled={wornToday || markWorn.isPending}
            />
            <Button label="Restyle" variant="outline" onPress={() => nav.navigate('OutfitGenerate')} />
            <Button
              label={isSaved ? 'Saved' : 'Save'}
              variant={isSaved ? 'accent' : 'outline'}
              onPress={handleSaveToggle}
              disabled={isSaved || saveOutfit.isPending}
            />
          </View>

          <View>
            <Eyebrow style={{ marginBottom: 10 }}>How was it?</Eyebrow>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${n} of 5`}
                  onPress={() => handleRate(n)}
                  hitSlop={6}>
                  <StarIcon size={28} color={n <= rating ? t.accent : t.fg3} active={n <= rating} />
                </Pressable>
              ))}
            </View>
            <TextInput
              value={notes}
              onChangeText={setNotes}
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
            {/* Save button surfaces only when the textarea diverges from what
                we last loaded. Without it the typed note was never persisted
                — audit L on PR #718. Cancel reverts to the persisted text
                so a half-typed change can be discarded explicitly. */}
            {notesDirty ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Button
                  label={saveNote.isPending ? 'Saving…' : 'Save note'}
                  size="sm"
                  onPress={() => {
                    if (!outfit) return;
                    saveNote.mutate(
                      { outfitId: outfit.id, note: notes },
                      {
                        onError: (err: unknown) =>
                          Alert.alert(
                            'Could not save note',
                            err instanceof Error ? err.message : 'Please try again.',
                          ),
                      },
                    );
                  }}
                  disabled={saveNote.isPending}
                />
                <Button
                  label="Cancel"
                  size="sm"
                  variant="outline"
                  onPress={() => setNotes(persistedNote)}
                  disabled={saveNote.isPending}
                />
              </View>
            ) : null}
          </View>

          <View>
            <View style={s.sectionHead}>
              <Eyebrow>Garments in this outfit</Eyebrow>
              <Text style={{ color: t.fg2, fontFamily: fonts.uiMed, fontSize: 11 }}>
                {outfit.outfit_items?.length ?? 0}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {(outfit.outfit_items ?? []).map((item) => (
                <PieceCard
                  key={item.id}
                  item={item}
                  // `push` not `navigate` — drill-down across detail routes. In a flow like
                  // GarmentDetail → OutfitDetail → tap piece, `navigate('GarmentDetail', …)`
                  // would collapse onto the existing GarmentDetail entry earlier in the stack,
                  // mutating its params and shortening the back stack. `push` always adds a
                  // fresh entry.
                  onPress={() => {
                    if (item.garment?.id) nav.push('GarmentDetail', { id: item.garment.id });
                  }}
                  // M13 — long-press → "Make this the anchor" prompt. Confirms,
                  // then routes to OutfitGenerate with the chosen anchor;
                  // the screen's anchor pill + anchor-missed signal then
                  // surface the lock state across regenerations.
                  onLongPress={() => {
                    const garmentId = item.garment?.id;
                    if (!garmentId) return;
                    const title = item.garment?.title;
                    Alert.alert(
                      tr('anchor.makeAnchor.title'),
                      title
                        ? tr('anchor.makeAnchor.body', { title })
                        : tr('anchor.makeAnchor.bodyFallback'),
                      [
                        { text: tr('anchor.makeAnchor.cancel'), style: 'cancel' },
                        {
                          text: tr('anchor.makeAnchor.confirm'),
                          onPress: () => nav.navigate('OutfitGenerate', { garmentId }),
                        },
                      ],
                    );
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MetaChip({ label }: { label: string }) {
  const t = useTokens();
  return (
    <View style={[s.metaChip, { backgroundColor: t.bg2, borderColor: t.border }]}>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 10,
          color: t.fg2,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        }}>
        {label}
      </Text>
    </View>
  );
}

function DetailThumbGrid({ outfit }: { outfit: OutfitWithItems }) {
  const items = (outfit.outfit_items ?? []).slice(0, 4);
  const fillerCount = Math.max(0, 4 - items.length);
  const fallbackHue = outfitGradientHue(outfit.id);
  return (
    <View style={s.thumbGrid}>
      {items.map((item) => (
        <DetailThumbCell key={item.id} item={item} fallbackHue={fallbackHue} />
      ))}
      {Array.from({ length: fillerCount }).map((_, i) => (
        <DetailThumbCell key={`filler-${i}`} item={null} fallbackHue={fallbackHue} />
      ))}
    </View>
  );
}

function DetailThumbCell({
  item,
  fallbackHue,
}: {
  item: OutfitItemWithGarment | null;
  fallbackHue: number;
}) {
  const t = useTokens();
  const garment = item?.garment ?? null;
  const imagePath = garment?.rendered_image_path ?? garment?.original_image_path ?? null;
  const { data: signedUrl } = useSignedUrl(imagePath);
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [imagePath, signedUrl]);
  const showImage = signedUrl && !broken;
  const hue = garment?.id ? outfitGradientHue(garment.id) : fallbackHue;
  const label = (item?.slot ?? garment?.category ?? '').toString().toUpperCase();

  return (
    <View style={[s.thumbCell, { borderColor: t.border }]}>
      <LinearGradient
        colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {showImage ? (
        <Image
          source={{ uri: signedUrl }}
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : null}
      {label ? (
        <View style={[s.thumbLabel, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[s.thumbLabelText, { color: t.fg2 }]}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PieceCard({
  item,
  onPress,
  onLongPress,
}: {
  item: OutfitItemWithGarment;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const t = useTokens();
  const garment = item.garment;
  const imagePath = garment?.rendered_image_path ?? garment?.original_image_path ?? null;
  const { data: signedUrl } = useSignedUrl(imagePath);
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [imagePath, signedUrl]);
  const showImage = signedUrl && !broken;
  const hue = garment?.id ? outfitGradientHue(garment.id) : outfitGradientHue(item.id);
  // Surface "Removed" rather than masquerading the missing garment as a real
  // piece named "Garment" — the card visually looks tappable but the press is
  // disabled, which without this label is just confusing. Audit Q on PR #718.
  const isOrphan = !garment?.id;
  const title = isOrphan ? 'Removed piece' : (garment?.title ?? item.slot ?? 'Garment').toString();
  const sub = isOrphan
    ? (item.slot ?? '').toString().toUpperCase()
    : [garment?.category, garment?.material].filter(Boolean).join(' · ').toUpperCase();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${sub ? `, ${sub}` : ''}`}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      disabled={!garment?.id}
      style={({ pressed }) => [
        s.pieceCard,
        {
          backgroundColor: t.card,
          borderColor: t.border,
          transform: pressed ? [{ scale: 0.97 }] : [],
          opacity: garment?.id ? 1 : 0.6,
        },
      ]}>
      <View style={[s.pieceCardThumb, { overflow: 'hidden' }]}>
        <LinearGradient
          colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {showImage ? (
          <Image
            source={{ uri: signedUrl }}
            onError={() => setBroken(true)}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 12.5,
            fontWeight: '600',
            color: t.fg,
            letterSpacing: -0.13,
          }}>
          {title}
        </Text>
        {sub ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 9.5,
              color: t.fg2,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginTop: 2,
            }}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  thumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumbCell: {
    width: '48%',
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  thumbLabelText: {
    fontFamily: fonts.uiSemi,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
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
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  pieceCard: {
    width: 140,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pieceCardThumb: {
    width: '100%',
    height: 100,
  },
});
