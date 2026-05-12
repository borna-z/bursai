// Bottom-left filmstrip showing the last 2 scans. Each tile renders the
// captured photo + a per-tile status overlay (in-flight shimmer / saved ✓ /
// failed red-dot / queued lightning).
//
// Subscribes to the screen's LiveScanEvents instance. Maintains its own
// ring buffer of size 2 in component state — the parent doesn't manage it.

import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { radii } from '../../theme/tokens';
import type { LiveScanEvents } from './events';
import type { PipelineErrorClass, ScanTileState } from './types';

const TILE_SIZE = 64;
const ACCENT_GOLD = '#FFD96B';
const RED = '#FF6B6B';
const AMBER = '#FFB95C';
const BORDER = 'rgba(255,255,255,0.15)';

const AMBER_CLASSES: ReadonlySet<PipelineErrorClass> = new Set(['multi_garment']);

interface Props {
  events: LiveScanEvents;
  onTilePress?: (tile: ScanTileState) => void;
}

export function Filmstrip({ events, onTilePress }: Props) {
  const [tiles, setTiles] = useState<ScanTileState[]>([]);

  useEffect(() => {
    const offStart = events.on('start', ({ sessionId, photoUri }) => {
      setTiles((prev) => {
        const next: ScanTileState = { sessionId, photoUri, stage: 'compress' };
        return [...prev, next].slice(-2);
      });
    });
    const offStage = events.on('stage', ({ sessionId, stage }) => {
      setTiles((prev) =>
        prev.map((t) => (t.sessionId === sessionId ? { ...t, stage } : t)),
      );
    });
    const offSaved = events.on('saved', ({ sessionId, garmentId }) => {
      setTiles((prev) =>
        prev.map((t) =>
          t.sessionId === sessionId ? { ...t, stage: 'done', garmentId } : t,
        ),
      );
    });
    const offQueued = events.on('queued', ({ sessionId }) => {
      setTiles((prev) =>
        prev.map((t) => (t.sessionId === sessionId ? { ...t, stage: 'queued' } : t)),
      );
    });
    const offFailed = events.on('failed', ({ sessionId, errorClass }) => {
      setTiles((prev) =>
        prev.map((t) =>
          t.sessionId === sessionId ? { ...t, stage: 'failed', errorClass } : t,
        ),
      );
    });
    return () => {
      offStart(); offStage(); offSaved(); offQueued(); offFailed();
    };
  }, [events]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {tiles.map((t) => (
        <ScanTile key={t.sessionId} tile={t} onPress={onTilePress} />
      ))}
    </View>
  );
}

function ScanTile({
  tile,
  onPress,
}: {
  tile: ScanTileState;
  onPress?: (tile: ScanTileState) => void;
}) {
  const enterProgress = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    enterProgress.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
  }, [enterProgress]);

  useEffect(() => {
    if (tile.stage === 'done' || tile.stage === 'failed' || tile.stage === 'queued') {
      cancelAnimation(shimmer);
      shimmer.value = 0;
      return;
    }
    shimmer.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 450 }),
        withTiming(0, { duration: 450 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(shimmer);
  }, [tile.stage, shimmer]);

  const tileStyle = useAnimatedStyle(() => ({
    opacity: enterProgress.value,
    transform: [{ scale: 0.4 + 0.6 * enterProgress.value }],
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value,
  }));

  const dotColor =
    tile.stage === 'failed'
      ? tile.errorClass && AMBER_CLASSES.has(tile.errorClass)
        ? AMBER
        : RED
      : null;

  return (
    <Pressable onPress={() => onPress?.(tile)} accessibilityRole="imagebutton">
      <Animated.View style={[styles.tile, tileStyle]}>
        <Image source={{ uri: tile.photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        <Animated.View style={[styles.shimmer, shimmerStyle]} />
        {tile.stage === 'done' ? (
          <View style={[styles.check, { backgroundColor: ACCENT_GOLD }]} />
        ) : null}
        {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
        {tile.stage === 'queued' ? <View style={styles.lightning} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    backgroundColor: '#1a1916',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  lightning: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#9BBFFF',
  },
});
