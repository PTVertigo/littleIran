import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ErrorBanner({ message }: { message: string }) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundElement"
      accessibilityRole="alert"
      style={[styles.banner, { borderColor: theme.error }]}>
      <ThemedText type="small" themeColor="error">
        {message}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
});
