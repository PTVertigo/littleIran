/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F1F21',
    background: '#ffffff',
    backgroundElement: '#F2F5F5',
    backgroundSelected: '#DDE6E7',
    textSecondary: '#52656A',
    primary: '#0B7A85',
    onPrimary: '#ffffff',
    accent: '#F4A62A',
    onAccent: '#0F1F21',
    error: '#B3261E',
    border: '#74868B',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#1C2022',
    backgroundSelected: '#2A3033',
    textSecondary: '#A9B8BC',
    primary: '#3CC7D2',
    onPrimary: '#000000',
    accent: '#F4A62A',
    onAccent: '#0F1F21',
    error: '#FF8A80',
    border: '#7D8E93',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
