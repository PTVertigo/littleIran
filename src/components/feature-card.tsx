import { SymbolView, type SFSymbol } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FeatureCardProps = {
  icon: SFSymbol;
  title: string;
  description: string;
};

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundElement"
      accessible
      accessibilityLabel={`${title}, coming soon. ${description}`}
      style={styles.card}>
      <View style={[styles.iconTile, { backgroundColor: theme.primary }]}>
        <SymbolView name={icon} size={24} tintColor={theme.onPrimary} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <View style={[styles.badge, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Coming soon
            </ThemedText>
          </View>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 20,
    borderCurve: 'continuous',
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  title: {
    fontSize: 17,
    fontWeight: 600,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 8,
  },
});
