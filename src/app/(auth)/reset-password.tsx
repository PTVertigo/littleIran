import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { PasswordChecklist } from '@/components/password-checklist';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ApiError, apiRequest } from '@/lib/api';
import { isStrongPassword } from '@/lib/validation';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [tokenRejected, setTokenRejected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const linkIsDead = !token || tokenRejected;

  async function submit() {
    if (loading) return;

    setError('');
    if (!isStrongPassword(password)) {
      setFieldError('Use 8-72 characters and meet every rule below.');
      return;
    }

    setFieldError('');
    setLoading(true);
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: { token, password },
      });
      setDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.password) {
        setFieldError(err.fieldErrors.password);
      } else if (err instanceof ApiError && err.status === 400) {
        setTokenRejected(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive">
      <ThemedText type="largeTitle" accessibilityRole="header">
        New password
      </ThemedText>

      {done ? (
        <>
          <ThemedText accessibilityRole="alert">
            Your password has been updated. Log in with your new password.
          </ThemedText>
          <PrimaryButton title="Log in" onPress={() => router.replace('/login')} />
        </>
      ) : (
        <>
          {linkIsDead ? (
            <>
              <ErrorBanner message="This reset link is invalid or has expired." />
              <PrimaryButton
                title="Request a new link"
                onPress={() => router.replace('/forgot-password')}
              />
            </>
          ) : (
            <>
              {error ? <ErrorBanner message={error} /> : null}
              <ThemedText themeColor="textSecondary">Choose a new password for your account.</ThemedText>
              <TextField
                label="New password"
                value={password}
                onChangeText={setPassword}
                error={fieldError}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={submit}
              />
              <PasswordChecklist password={password} />
              <PrimaryButton title="Update password" loading={loading} onPress={submit} />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
