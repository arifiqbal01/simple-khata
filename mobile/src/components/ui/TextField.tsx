import React from 'react';
import {
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { AppText } from './AppText';

export interface TextFieldProps
  extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
}

export function TextField({
  label,
  error,
  hint,
  className = '',
  ...props
}: TextFieldProps) {
  return (
    <View className={`gap-2 ${className}`}>
      {label ? (
        <AppText
          variant="small"
          className="font-medium text-foreground"
        >
          {label}
        </AppText>
      ) : null}

      <TextInput
        {...props}
        placeholderTextColor="#9A9A93"
        className={`
          min-h-14
          rounded-control
          border
          bg-surface
          px-4
          font-sans
          text-body
          text-foreground
          ${
            error
              ? 'border-udhaar'
              : 'border-border'
          }
        `}
      />

      {error ? (
        <AppText
          variant="caption"
          className="text-udhaar"
        >
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}