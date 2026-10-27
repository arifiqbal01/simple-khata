
import React from 'react';
import {
  Text,
  type TextProps,
} from 'react-native';

export type AppTextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyMedium'
  | 'small'
  | 'caption'
  | 'money'
  | 'moneyLarge';

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  className?: string;
}

const variantClasses: Record<AppTextVariant, string> = {
  display: 'font-bold text-display text-foreground',
  title: 'font-bold text-title text-foreground',
  heading: 'font-semibold text-heading text-foreground',
  body: 'font-sans text-body text-foreground',
  bodyMedium: 'font-medium text-body text-foreground',
  small: 'font-sans text-small text-muted',
  caption: 'font-medium text-caption text-muted',
  money: 'font-bold text-money text-foreground',
  moneyLarge: 'font-bold text-money-lg text-foreground',
};

/**
 * Merges the default variant styles with custom styles.
 *
 * Custom className values take precedence over
 * conflicting variant classes.
 */
function mergeTextClasses(
  baseClasses: string,
  customClasses: string
): string {
  if (!customClasses.trim()) {
    return baseClasses;
  }

  const customTokens = customClasses
    .trim()
    .split(/\s+/);

  const hasCustomFontSize = customTokens.some(
    (token) =>
      token.startsWith('text-[') ||
      [
        'text-xs',
        'text-sm',
        'text-base',
        'text-lg',
        'text-xl',
        'text-2xl',
        'text-3xl',
        'text-4xl',
        'text-5xl',
        'text-display',
        'text-title',
        'text-heading',
        'text-body',
        'text-small',
        'text-caption',
        'text-money',
        'text-money-lg',
      ].includes(token)
  );

  const hasCustomColor = customTokens.some(
    (token) =>
      token.startsWith('text-[#') ||
      token.startsWith('text-white') ||
      token.startsWith('text-black') ||
      token.startsWith('text-muted') ||
      token.startsWith('text-foreground') ||
      token.startsWith('text-inverse') ||
      token.startsWith('text-red-') ||
      token.startsWith('text-green-') ||
      token.startsWith('text-gray-') ||
      token.startsWith('text-slate-') ||
      token.startsWith('text-emerald-') ||
      token.startsWith('text-primary')
  );

  const hasCustomFontFamily = customTokens.some(
    (token) =>
      token.startsWith('font-spline-') ||
      [
        'font-sans',
        'font-serif',
        'font-mono',
      ].includes(token)
  );

  const hasCustomFontWeight = customTokens.some(
    (token) =>
      [
        'font-thin',
        'font-light',
        'font-normal',
        'font-medium',
        'font-semibold',
        'font-bold',
        'font-extrabold',
        'font-black',
      ].includes(token)
  );

  const baseTokens = baseClasses
    .split(/\s+/)
    .filter((token) => {
      if (
        hasCustomFontSize &&
        [
          'text-display',
          'text-title',
          'text-heading',
          'text-body',
          'text-small',
          'text-caption',
          'text-money',
          'text-money-lg',
        ].includes(token)
      ) {
        return false;
      }

      if (
        hasCustomColor &&
        [
          'text-foreground',
          'text-muted',
          'text-inverse',
        ].includes(token)
      ) {
        return false;
      }

      if (
        hasCustomFontFamily &&
        [
          'font-sans',
          'font-serif',
          'font-mono',
        ].includes(token)
      ) {
        return false;
      }

      if (
        hasCustomFontWeight &&
        [
          'font-thin',
          'font-light',
          'font-normal',
          'font-medium',
          'font-semibold',
          'font-bold',
          'font-extrabold',
          'font-black',
        ].includes(token)
      ) {
        return false;
      }

      return true;
    });

  return [
    ...baseTokens,
    ...customTokens,
  ].join(' ');
}

export function AppText({
  variant = 'body',
  className = '',
  ...props
}: AppTextProps) {
  const resolvedClassName = mergeTextClasses(
    variantClasses[variant],
    className
  );

  return (
    <Text
      {...props}
      className={resolvedClassName}
    />
  );
}
