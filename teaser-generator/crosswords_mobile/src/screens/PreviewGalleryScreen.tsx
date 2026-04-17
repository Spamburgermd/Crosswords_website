/**
 * src/screens/PreviewGalleryScreen.tsx
 * -----------------------------------------------------------
 * Debug-only gallery that lets designers preview the Crossroads
 * visuals without loading the real game flow. Each section renders
 * simple shapes using the active design tokens so we can confirm
 * spacing, typography, and colors match the HTML mock.
 *
 * Usage:
 * 1. In `.env`, set `EXPO_PUBLIC_PREVIEW_SCREEN=crossroads-gallery`.
 * 2. Start Expo (`npx expo start`) and reload the app.
 * 3. Navigate the cards below to see how the tokens look on-device.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import useUIStore from '@stores/uiStore';
import HeaderChip from '@ui/HeaderChip';
import HintTile from '@ui/HintTile';
import ScreenFrame from '@ui/ScreenFrame';
import SegmentButton from '@ui/SegmentButton';

export default function PreviewGalleryScreen(): React.JSX.Element {
  const tokens = useUIStore((state) => state.designTokens);

  const sampleSegments = ['Tode Crossword', 'New Crossword', 'Dessert Crossword'];
  const sampleClue = ['H', 'I', 'N', 'T', 'S', 'C', 'L', 'U', 'E', 'S'];

  return (
    <ScreenFrame>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { gap: tokens.spacing.md, paddingBottom: tokens.spacing.md },
        ]}
      >
        <Text
          style={[
            styles.heading,
            {
              color: tokens.colors.textPrimary,
              fontFamily: tokens.typography.displayFamily,
              fontSize: tokens.typography.headingSize,
            },
          ]}
        >
          Crossroads Preview
        </Text>

        <View
          style={[
            styles.section,
            {
              backgroundColor: tokens.colors.canvas,
              padding: tokens.spacing.md,
              gap: tokens.spacing.md,
            },
          ]}
        >
          <Text
            style={[
              styles.label,
              { color: tokens.colors.textPrimary, fontFamily: tokens.typography.bodyFamily },
            ]}
          >
            Header + Segment Layout
          </Text>
          <View
            style={{
              backgroundColor: tokens.colors.canvas,
              paddingHorizontal: tokens.spacing.lg,
              paddingTop: tokens.spacing.lg,
              paddingBottom: tokens.spacing.md,
            }}
          >
            <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
              <HeaderChip label="Citizenware" subLabel="Fantasy" />
              <View
                style={{
                  width: 64,
                  height: 64,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: tokens.colors.accent,
                    fontFamily: tokens.typography.displayFamily,
                    fontSize: tokens.typography.headingSize,
                  }}
                >
                  ✠
                </Text>
              </View>
              <HeaderChip label="Citrestanare" subLabel="Creatures" align="right" />
            </View>
          </View>
          <View
            style={{
              backgroundColor: tokens.colors.surfaceHighlight,
              borderRadius: tokens.radii.lg,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                backgroundColor: tokens.colors.surfacePrimary,
                padding: tokens.spacing.md,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  gap: tokens.spacing.xs,
                  backgroundColor: tokens.colors.surfacePrimary,
                  borderRadius: tokens.radii.md,
                  padding: tokens.spacing.xs,
                }}
              >
                {sampleSegments.map((segment, index) => (
                  <SegmentButton
                    key={segment}
                    label={segment}
                    active={index === 0}
                    style={{ flex: 1 }}
                    variant="bare"
                  />
                ))}
              </View>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: tokens.colors.surfacePrimary,
              borderRadius: tokens.radii.md,
              padding: tokens.spacing.md,
              borderColor: tokens.colors.borderSubtle,
            },
          ]}
        >
          <Text
            style={[
              styles.label,
              { color: tokens.colors.textSecondary, fontFamily: tokens.typography.bodyFamily },
            ]}
          >
            Hint Tiles
          </Text>
          <View style={styles.grid}>
            {sampleClue.map((letter, index) => {
              const status =
                index % 3 === 0
                  ? 'correct'
                  : index % 3 === 1
                    ? 'present'
                    : 'absent';
              return <HintTile key={`${letter}-${index}`} letter={letter} status={status} />;
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  heading: {
    textAlign: 'center',
  },
  section: {
    borderWidth: 1,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
