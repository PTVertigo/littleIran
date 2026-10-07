import { ScrollView, StyleSheet } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';

export default function HomeScreen() {
  const { state } = useSession();
  const firstName = state.status === 'signedIn' ? state.user.firstName : '';

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <ThemedText type="largeTitle" accessibilityRole="header">
        Hello, {firstName}
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        Your community in Southern Ontario is coming together. Here is what is on the way.
      </ThemedText>

      <FeatureCard
        icon="storefront"
        title="Businesses"
        description="Find Iranian-owned restaurants, shops and services near you."
      />
      <FeatureCard
        icon="calendar"
        title="Events"
        description="Festivals, workshops and gatherings from the community."
      />
      <FeatureCard
        icon="bubble.left.and.bubble.right"
        title="Forums"
        description="Ask questions, share tips and meet your neighbours."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
});
