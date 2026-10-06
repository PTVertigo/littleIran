import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export const unstable_settings = { initialRouteName: 'welcome' };

export default function AuthLayout() {
  const colors = useTheme();

  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: colors.primary,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
    </Stack>
  );
}
