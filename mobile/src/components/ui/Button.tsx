import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  type PressableProps,
} from 'react-native';

import { AppText } from './AppText';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger';

export interface ButtonProps
  extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

const containerClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary',
  secondary:
    'border border-border-strong bg-surface',
  danger: 'bg-udhaar',
};

const textClasses: Record<ButtonVariant, string> = {
  primary: 'text-inverse',
  secondary: 'text-foreground',
  danger: 'text-inverse',
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled = false,
  left,
  right,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{
        disabled: isDisabled,
        busy: loading,
      }}
      className={`
        min-h-14
        flex-row
        items-center
        justify-center
        gap-2
        rounded-control
        px-5
        ${containerClasses[variant]}
        ${
          isDisabled
            ? 'opacity-40'
            : 'active:opacity-70'
        }
        ${className}
      `}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <>
          {left ? <View>{left}</View> : null}

          <AppText
            variant="bodyMedium"
            className={textClasses[variant]}
          >
            {label}
          </AppText>

          {right ? <View>{right}</View> : null}
        </>
      )}
    </Pressable>
  );
}