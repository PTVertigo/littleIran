import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type PrimaryButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: 'filled' | 'plain';
  loading?: boolean;
};

export function PrimaryButton({
  title,
  variant = 'filled',
  loading = false,
  disabled,
  style,
  ...rest
}: PrimaryButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const filled = variant === 'filled';
  const labelColor = filled ? theme.onPrimary : theme.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      style={(state) => [
        styles.base,
        filled && { backgroundColor: theme.primary },
        state.pressed && styles.pressed,
        disabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <ThemedText style={[styles.label, { color: labelColor }]}>{title}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
