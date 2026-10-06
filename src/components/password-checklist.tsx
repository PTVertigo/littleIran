import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PASSWORD_RULES } from '@/lib/validation';

export function PasswordChecklist({ password }: { password: string }) {
  const theme = useTheme();

  return (
    <View style={styles.list}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <View
            key={rule.label}
            style={styles.row}
            accessible
            accessibilityLabel={`${rule.label}, ${met ? 'met' : 'not met'}`}>
            <SymbolView
              name={met ? 'checkmark.circle.fill' : 'circle'}
              size={18}
              tintColor={met ? theme.primary : theme.textSecondary}
            />
            <ThemedText type="small" themeColor={met ? 'text' : 'textSecondary'}>
              {rule.label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
