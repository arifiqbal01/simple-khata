import React, { useState } from 'react';
import {
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { AppText } from './AppText';

export interface MoneyInputProps
  extends Omit<TextInputProps, 'keyboardType'> {
  label?: string;
  error?: string;
  className?: string;
}

export function MoneyInput({
  label,
  error,
  className = '',
  onFocus,
  onBlur,
  ...props
}: MoneyInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className={`gap-2 ${className}`}>
      {label ? (
        <AppText
          className="
            font-spline-semibold
            text-[14px]
            leading-[20px]
            text-muted
          "
        >
          {label}
        </AppText>
      ) : null}

      <View
        className={`
          min-h-[72px]
          flex-row
          items-center
          border-b
          ${
            error
              ? 'border-udhaar'
              : focused
                ? 'border-foreground'
                : 'border-border-strong'
          }
        `}
      >
        <AppText
          className="
            mr-3
            font-spline-semibold
            text-[26px]
            leading-[34px]
            text-muted
          "
        >
          Rs
        </AppText>

        <TextInput
          {...props}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="0"
          placeholderTextColor="#9A9A93"
          selectionColor="#181816"
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          className="
            min-w-0
            flex-1
            border-0
            bg-transparent
            p-0
            font-spline-bold
            text-[42px]
            leading-[50px]
            text-foreground
            outline-none
          "
        />
      </View>

      {error ? (
        <AppText
          variant="caption"
          className="text-udhaar"
        >
          {error}
        </AppText>
      ) : null}
    </View>
  );
}