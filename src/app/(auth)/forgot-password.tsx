import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ApiError, apiRequest } from '@/lib/api';
import { isValidEmail } from '@/lib/validation';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  async function submit() {
    if (loading) return;

    const trimmed = email.trim();
    setError('');
    if (!isValidEmail(trimmed)) {
      setFieldError('Enter a valid email address.');
      return;
    }

    setFieldError('');
    setLoading(true);
    try {
      const data = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: trimmed },
      });
      setConfirmation(data.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
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
        Reset password
      </ThemedText>

      {confirmation ? (
        <>
          <ThemedText accessibilityRole="alert">{confirmation}</ThemedText>
          <ThemedText themeColor="textSecondary">
            The link expires in 1 hour. Open it on this device to choose a new password.
          </ThemedText>
          <PrimaryButton title="Back to log in" onPress={() => router.replace('/login')} />
        </>
      ) : (
        <>
          <ThemedText themeColor="textSecondary">
            Enter your email and we will send you a link to choose a new password.
          </ThemedText>

          {error ? <ErrorBanner message={error} /> : null}

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={fieldError}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={submit}
          />
          <PrimaryButton title="Send reset link" loading={loading} onPress={submit} />
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
