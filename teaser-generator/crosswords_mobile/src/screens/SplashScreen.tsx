/**
 * src/screens/SplashScreen.tsx
 * Branded splash screen shown during app initialization and font loading
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

/**
 * Animated dot component for loading indicator
 * Pulses opacity in a continuous loop with configurable delay for stagger effect
 */
function AnimatedDot({ delay }: { delay: number }): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [delay, opacity]);

  return (
    <Animated.View style={[styles.dot, { opacity }]} />
  );
}

/**
 * SplashScreen Component
 *
 * Displays branded splash screen with:
 * - CW Motif logo
 * - CrosSwords wordmark
 * - Animated loading dots
 * - Artisan Beef attribution
 */
export default function SplashScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* CW Motif Logo */}
        <Image
          source={require('../../assets/design/icons/CWMotifRed.png')}
          style={[styles.motifLogo, { tintColor: '#E7131A' }]}
          resizeMode="contain"
        />

        {/* CrosSwords Wordmark */}
        <Image
          source={require('../../assets/design/icons/CrosswordsBlackRedBent90.png')}
          style={styles.wordmark}
          resizeMode="contain"
        />

        {/* Animated Red Dots Loading Indicator */}
        <View style={styles.dotsContainer}>
          <AnimatedDot delay={0} />
          <AnimatedDot delay={200} />
          <AnimatedDot delay={400} />
        </View>
      </View>

      {/* Bottom Attribution */}
      <View style={styles.footer}>
        <Image
          source={require('../../assets/design/icons/BluePrintBurgernotext_centered.png')}
          style={styles.burgerLogo}
          resizeMode="contain"
        />
        <Text style={styles.burgerGamesText}>ARTISAN BEEF DESIGNS</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: -60,
  },
  motifLogo: {
    width: 300,
    height: 285,
    marginBottom: 10,
  },
  wordmark: {
    width: 295,
    height: 54,
    marginBottom: 10,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E7131A',
    marginHorizontal: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  burgerGamesText: {
    fontFamily: 'NotoSerif_400Regular',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
  },
  burgerLogo: {
    width: 26,
    height: 26,
  },
});
