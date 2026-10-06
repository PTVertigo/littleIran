import * as Haptics from 'expo-haptics';
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
import { isStrongPassword, isValidEmail, NAME_MAX_LENGTH } from '@/lib/validation';

type Field = 'firstName' | 'lastName' | 'email' | 'password';

function validate(values: Record<Field, string>) {
  const errors: Partial<Record<Field, string>> = {};
  if (!values.firstName || values.firstName.length > NAME_MAX_LENGTH) {
    errors.firstName = 'Enter your first name.';
  }
  if (!values.lastName || values.lastName.length > NAME_MAX_LENGTH) {
    errors.lastName = 'Enter your last name.';
  }
  if (!isValidEmail(values.email)) errors.email = 'Enter a valid email address.';
  if (!isStrongPassword(values.password)) {
    errors.password = 'Use 8-72 characters and meet every rule below.';
  }
  return errors;
}

export default function RegisterScreen() {
  const { register } = useSession();
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [values, setValues] = useState<Record<Field, string>>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setValue = (field: Field) => (text: string) =>
    setValues((current) => ({ ...current, [field]: text }));

  async function submit() {
    if (loading) return;

    const trimmed = {
      ...values,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
    };
    const errors = validate(trimmed);
    setError('');
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    try {
      await register(trimmed);
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
        Create account
      </ThemedText>
      <ThemedText themeColor="textSecondary">Join the Iranian community in your area.</ThemedText>

      {error ? <ErrorBanner message={error} /> : null}

      <TextField
        label="First name"
        value={values.firstName}
        onChangeText={setValue('firstName')}
        error={fieldErrors.firstName}
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="next"
        onSubmitEditing={() => lastNameRef.current?.focus()}
      />
      <TextField
        ref={lastNameRef}
        label="Last name"
        value={values.lastName}
        onChangeText={setValue('lastName')}
        error={fieldErrors.lastName}
        autoComplete="family-name"
        textContentType="familyName"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
        label="Email"
        value={values.email}
        onChangeText={setValue('email')}
        error={fieldErrors.email}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={values.password}
        onChangeText={setValue('password')}
        error={fieldErrors.password}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <PasswordChecklist password={values.password} />

      <PrimaryButton title="Create account" loading={loading} onPress={submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
