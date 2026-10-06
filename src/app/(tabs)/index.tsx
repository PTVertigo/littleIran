import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';

export default function HomeScreen() {
  const colors = useTheme();
  const { state } = useSession();
  const firstName = state.status === 'signedIn' ? state.user.firstName : '';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ThemedText type="largeTitle" accessibilityRole="header">
        Hello, {firstName}
      </ThemedText>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
  },
});
