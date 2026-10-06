import React from 'react';
import { Text, type TextProps } from 'react-native';

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

export function AppText({
  variant = 'body',
  className = '',
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      className={`${variantClasses[variant]} ${className}`}
    />
  );
}