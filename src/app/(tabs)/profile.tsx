import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';

export default function ProfileScreen() {
  const colors = useTheme();
  const { signOut } = useSession();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ThemedText type="largeTitle" accessibilityRole="header">
        Profile
      </ThemedText>
      <PrimaryButton title="Log out" variant="plain" onPress={signOut} />
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
