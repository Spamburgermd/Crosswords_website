/**
 * src/components/PalettePickerModal.tsx
 * -----------------------------------------------------------
 * Modal picker for board feedback color schemes.
 *
 * A single vertical wheel shows one row per palette. Each row displays all
 * four feedback swatches side-by-side so the columns always move together.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import useUIStore from '@stores/uiStore';
import {
  TILE_PALETTE_IDS,
  TILE_PALETTE_OPTIONS,
  TILE_PALETTE_SEMANTICS,
  getTilePaletteOptionById,
  getTilePalettePreviewEntries,
  type TilePaletteId,
  type TilePaletteOption,
} from '@src/theme/tilePalette';

const tokens = DESIGN_TOKEN_SETS.atlantic;
const VISIBLE_ROWS = 7;
const CENTER_ROW_INDEX = Math.floor(VISIBLE_ROWS / 2);
const ROW_HEIGHT = 38;
const WHEEL_HEIGHT = VISIBLE_ROWS * ROW_HEIGHT;

type PalettePickerModalProps = {
  visible: boolean;
  selectedSchemeId: string;
  onCancel: () => void;
  onConfirm: (schemeId: string) => void;
};

type WheelRow =
  | { kind: 'pad'; key: string }
  | { kind: 'palette'; key: string; option: TilePaletteOption };

function buildWheelRows(): WheelRow[] {
  const padRows: WheelRow[] = Array.from({ length: CENTER_ROW_INDEX }, (_, index) => ({
    kind: 'pad',
    key: `pad-${index}`,
  }));

  const paletteRows: WheelRow[] = TILE_PALETTE_OPTIONS.map((option) => ({
    kind: 'palette',
    key: option.id,
    option,
  }));

  return [...padRows, ...paletteRows, ...padRows.map((row, index) => ({ ...row, key: `tail-${index}` }))];
}

function clampPaletteIndex(index: number): number {
  return Math.max(0, Math.min(TILE_PALETTE_IDS.length - 1, index));
}

export default function PalettePickerModal({
  visible,
  selectedSchemeId,
  onCancel,
  onConfirm,
}: PalettePickerModalProps): React.JSX.Element {
  const darkModeEnabled = useUIStore((state) => state.darkModeEnabled);
  const [draftSchemeId, setDraftSchemeId] = useState<TilePaletteId>(getTilePaletteOptionById(selectedSchemeId).id);
  const draftSchemeIdRef = useRef(draftSchemeId);
  draftSchemeIdRef.current = draftSchemeId;
  const wheelRows = useMemo(() => buildWheelRows(), []);
  const wheelRef = useRef<FlatList<WheelRow> | null>(null);

  const draftOption = getTilePaletteOptionById(draftSchemeId);
  const previewEntries = getTilePalettePreviewEntries(draftSchemeId);
  const backgroundColor = darkModeEnabled ? 'rgba(7, 7, 8, 0.72)' : 'rgba(15, 15, 16, 0.42)';
  const cardColor = darkModeEnabled ? '#181818' : '#ffffff';
  const borderColor = darkModeEnabled ? '#2c2c2e' : '#dedede';
  const titleColor = darkModeEnabled ? '#f2f2f2' : '#1c1b18';
  const bodyColor = darkModeEnabled ? '#d0d0d0' : '#5c5c5c';
  const mutedColor = darkModeEnabled ? '#acacac' : '#7a7a7a';
  const wheelBackground = darkModeEnabled ? '#121212' : '#fafafa';
  const wheelBorder = darkModeEnabled ? '#303032' : '#d9d9d9';
  const centerRowTint = darkModeEnabled ? 'rgba(231, 19, 26, 0.14)' : 'rgba(231, 19, 26, 0.08)';

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    const offset = clampPaletteIndex(index) * ROW_HEIGHT;
    wheelRef.current?.scrollToOffset({ offset, animated });
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const nextIndex = clampPaletteIndex(Math.round(offsetY / ROW_HEIGHT));
    const nextId = TILE_PALETTE_IDS[nextIndex];
    if (nextId && nextId !== draftSchemeIdRef.current) {
      setDraftSchemeId(nextId);
    }
  }, []);

  const handleSettle = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = clampPaletteIndex(Math.round(event.nativeEvent.contentOffset.y / ROW_HEIGHT));
    const nextId = TILE_PALETTE_IDS[nextIndex];
    if (nextId) {
      setDraftSchemeId(nextId);
      scrollToIndex(nextIndex, true);
    }
  }, [scrollToIndex]);

  const handleEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const velocityY = event.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocityY) < 0.05) {
      handleSettle(event);
    }
  }, [handleSettle]);

  useEffect(() => {
    if (!visible) return;

    const nextOption = getTilePaletteOptionById(selectedSchemeId);
    const nextIndex = TILE_PALETTE_IDS.indexOf(nextOption.id);
    setDraftSchemeId(nextOption.id);

    requestAnimationFrame(() => {
      scrollToIndex(nextIndex >= 0 ? nextIndex : 0, false);
    });
  }, [scrollToIndex, selectedSchemeId, visible]);

  const renderItem = useCallback(({ item }: { item: WheelRow }) => {
    if (item.kind === 'pad') {
      return <View style={styles.padRow} />;
    }

    const entries = getTilePalettePreviewEntries(item.option.palette);
    const isSelected = item.option.id === draftSchemeIdRef.current;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.option.title}
        onPress={() => {
          const index = TILE_PALETTE_IDS.indexOf(item.option.id);
          setDraftSchemeId(item.option.id);
          scrollToIndex(index >= 0 ? index : 0, true);
        }}
        style={[
          styles.swatchRow,
          isSelected && { backgroundColor: darkModeEnabled ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
        ]}
      >
        {entries.map((entry) => (
          <View
            key={entry.key}
            style={[
              styles.swatchTile,
              {
                backgroundColor: entry.bg,
                borderColor: isSelected ? '#E7131A' : 'transparent',
              },
            ]}
          >
            <Text style={[styles.swatchLetter, { color: entry.letter }]}>A</Text>
          </View>
        ))}
      </Pressable>
    );
  }, [darkModeEnabled, scrollToIndex]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={[styles.backdrop, { backgroundColor }]} onPress={onCancel}>
        <Pressable
          accessibilityViewIsModal
          style={[styles.card, { backgroundColor: cardColor, borderColor }]}
          onPress={() => {}}
        >
          <Text style={[styles.title, { color: titleColor }]}>Color Scheme</Text>
          <Text style={[styles.subtitle, { color: bodyColor }]}>
            Scroll to browse palettes.
          </Text>

          <View style={styles.columnLabelsRow}>
            {TILE_PALETTE_SEMANTICS.map(({ key, label }) => (
              <Text key={key} style={[styles.columnLabel, { color: mutedColor }]}>{label}</Text>
            ))}
          </View>

          <View
            style={[
              styles.wheelViewport,
              { height: WHEEL_HEIGHT, backgroundColor: wheelBackground, borderColor: wheelBorder },
            ]}
          >
            <FlatList
              ref={wheelRef}
              data={wheelRows}
              keyExtractor={(item) => item.key}
              bounces={false}
              showsVerticalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={ROW_HEIGHT}
              getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
              scrollEventThrottle={64}
              extraData={draftSchemeId}
              onScroll={handleScroll}
              onMomentumScrollEnd={handleSettle}
              onScrollEndDrag={handleEndDrag}
              renderItem={renderItem}
            />
            <View
              pointerEvents="none"
              style={[
                styles.centerHighlight,
                {
                  top: CENTER_ROW_INDEX * ROW_HEIGHT,
                  height: ROW_HEIGHT,
                  borderColor: '#E7131A',
                  backgroundColor: centerRowTint,
                },
              ]}
            />
          </View>

          <View style={[styles.selectionCard, { borderColor, backgroundColor: wheelBackground }]}>
            <Text style={[styles.selectionTitle, { color: titleColor }]}>{draftOption.title}</Text>
            <Text style={[styles.selectionBody, { color: bodyColor }]}>{draftOption.description}</Text>
            <View style={styles.previewRow}>
              {previewEntries.map((entry) => (
                <View key={entry.key} style={styles.previewChipWrap}>
                  <View style={[styles.previewChip, { backgroundColor: entry.bg }]}>
                    <Text style={[styles.previewChipLetter, { color: entry.letter }]}>A</Text>
                  </View>
                  <Text style={[styles.previewChipLabel, { color: mutedColor }]}>{entry.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel color scheme selection"
              onPress={onCancel}
              style={[styles.secondaryButton, { borderColor }]}
            >
              <Text style={[styles.secondaryButtonText, { color: titleColor }]}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Save ${draftOption.title} color scheme`}
              onPress={() => onConfirm(draftSchemeId)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    padding: 16,
    gap: 14,
  },
  title: {
    fontFamily: tokens.typography.displayFamily,
    fontSize: 18,
  },
  subtitle: {
    fontFamily: tokens.typography.bodyFamily,
    fontSize: 13,
    lineHeight: 18,
  },
  columnLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  columnLabel: {
    fontFamily: tokens.typography.displayFamily,
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
    flex: 1,
  },
  wheelViewport: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  padRow: {
    height: ROW_HEIGHT,
  },
  swatchRow: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  swatchTile: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  swatchLetter: {
    fontFamily: tokens.typography.displayFamily,
    fontSize: 13,
  },
  centerHighlight: {
    position: 'absolute',
    left: 4,
    right: 4,
    borderWidth: 1,
    borderRadius: 8,
  },
  selectionCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.sm,
    padding: 12,
    gap: 8,
  },
  selectionTitle: {
    fontFamily: tokens.typography.displayFamily,
    fontSize: 15,
  },
  selectionBody: {
    fontFamily: tokens.typography.bodyFamily,
    fontSize: 13,
    lineHeight: 18,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  previewChipWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  previewChip: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewChipLetter: {
    fontFamily: tokens.typography.displayFamily,
    fontSize: 12,
  },
  previewChipLabel: {
    fontFamily: tokens.typography.bodyFamily,
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: tokens.radii.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: tokens.typography.displayFamily,
    fontSize: 13,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#E7131A',
    borderRadius: tokens.radii.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: tokens.typography.displayFamily,
    fontSize: 13,
  },
});
