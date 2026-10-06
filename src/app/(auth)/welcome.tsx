import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function WelcomeScreen() {
  const colors = useTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.hero}>
        <View style={[styles.emblem, { backgroundColor: colors.primary }]}>
          <SymbolView name="mappin.and.ellipse" size={48} tintColor={colors.onPrimary} />
          <View style={[styles.dot, { backgroundColor: colors.accent }]} />
        </View>
        <ThemedText type="largeTitle" accessibilityRole="header" style={styles.centered}>
          LittleIran
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={[styles.tagline, styles.centered]}>
          Discover Iranian businesses, events and community across Southern Ontario.
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  emblem: {
    width: 104,
    height: 104,
    borderRadius: 28,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  dot: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  centered: {
    textAlign: 'center',
  },
  tagline: {
    fontSize: 17,
    lineHeight: 24,
    maxWidth: 320,
  },
});
