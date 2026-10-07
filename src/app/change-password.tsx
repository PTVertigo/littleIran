import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { PasswordChecklist } from '@/components/password-checklist';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { isStrongPassword } from '@/lib/validation';

type Field = 'currentPassword' | 'newPassword';

export default function ChangePasswordScreen() {
  const { authedRequest } = useSession();
  const newPasswordRef = useRef<TextInput>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (loading) return;

    const errors: Partial<Record<Field, string>> = {};
    if (!currentPassword) errors.currentPassword = 'Enter your current password.';
    if (!isStrongPassword(newPassword)) {
      errors.newPassword = 'Use 8-72 characters and meet every rule below.';
    }
    setError('');
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    try {
      await authedRequest('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
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
        Change password
      </ThemedText>

      {done ? (
        <>
          <ThemedText accessibilityRole="alert">
            Your password has been updated. Your other devices will need to log in again.
          </ThemedText>
          <PrimaryButton title="Done" onPress={() => router.back()} />
        </>
      ) : (
        <>
          {error ? <ErrorBanner message={error} /> : null}

          <TextField
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            error={fieldErrors.currentPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="next"
            onSubmitEditing={() => newPasswordRef.current?.focus()}
          />
          <TextField
            ref={newPasswordRef}
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            error={fieldErrors.newPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <PasswordChecklist password={newPassword} />

          <PrimaryButton title="Update password" loading={loading} onPress={submit} />
          <PrimaryButton title="Cancel" variant="plain" onPress={() => router.back()} />
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
