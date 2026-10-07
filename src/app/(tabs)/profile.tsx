import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.rowValue}>{value}</ThemedText>
    </View>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { state, signOut } = useSession();
  if (state.status !== 'signedIn') return null;

  const { user } = state;
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
  const memberSince = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  function confirmLogOut() {
    Alert.alert('Log out?', 'You will need to log in again to use LittleIran.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]} accessibilityElementsHidden>
          <ThemedText style={[styles.initials, { color: theme.onPrimary }]}>{initials}</ThemedText>
        </View>
        <ThemedText type="largeTitle" accessibilityRole="header" style={styles.name}>
          {user.firstName} {user.lastName}
        </ThemedText>
      </View>

      <ThemedView type="backgroundElement" style={styles.group}>
        <Row label="Email" value={user.email} />
        <Row label="Member since" value={memberSince} />
        <Row label="Role" value={user.role === 'admin' ? 'Administrator' : 'Member'} />
      </ThemedView>

      <View style={styles.actions}>
        <PrimaryButton title="Change password" onPress={() => router.push('/change-password')} />
        <PrimaryButton title="Log out" variant="destructive" onPress={confirmLogOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 32,
    fontWeight: 600,
  },
  name: {
    textAlign: 'center',
  },
  group: {
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    gap: Spacing.half,
  },
  rowValue: {
    fontSize: 17,
  },
  actions: {
    gap: Spacing.two,
  },
});
