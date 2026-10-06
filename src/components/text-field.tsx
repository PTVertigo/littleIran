import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function TextField({ label, error, secureTextEntry, style, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.error : theme.border,
          },
        ]}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={secureTextEntry && !revealed}
          style={[styles.input, { color: theme.text }, style]}
          {...rest}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={8}
            onPress={() => setRevealed((value) => !value)}
            style={styles.toggle}>
            <ThemedText type="small" themeColor="primary">
              {revealed ? 'Hide' : 'Show'}
            </ThemedText>
          </Pressable>
        )}
      </View>
      {error ? (
        <ThemedText type="small" themeColor="error" accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  field: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
  },
  input: {
    flex: 1,
    fontSize: 17,
    paddingVertical: Spacing.two,
  },
  toggle: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
