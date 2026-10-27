
import React, { memo } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui';
import type {
  UdhaarEntryMode,
} from '@/hooks/ledger/udhaar/types';

export interface UdhaarModeToggleProps {
  mode: UdhaarEntryMode;
  onChangeMode: (mode: UdhaarEntryMode) => void;
  disabled?: boolean;
  className?: string;
}

const MODES: {
  value: UdhaarEntryMode;
  label: string;
}[] = [
  { value: 'amount', label: 'Amount' },
  { value: 'quantity', label: 'Quantity' },
];

export const UdhaarModeToggle = memo(
  function UdhaarModeToggle({
    mode,
    onChangeMode,
    disabled = false,
    className = '',
  }: UdhaarModeToggleProps) {
    return (
      <View
        className={`h-9 flex-row items-center rounded-xl border border-border bg-input-background p-[3px] ${className}`}
        accessibilityRole="radiogroup"
        accessibilityLabel="Udhaar entry mode"
      >
        {MODES.map((option) => {
          const selected = mode === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => {
                if (!disabled && !selected) {
                  onChangeMode(option.value);
                }
              }}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityLabel={`${option.label} entry mode`}
              accessibilityState={{
                checked: selected,
                disabled,
              }}
              className={`h-full flex-1 items-center justify-center rounded-lg px-2 ${
                selected
                  ? 'bg-primary'
                  : 'bg-transparent'
              } ${
                disabled
                  ? 'opacity-40'
                  : 'active:opacity-80'
              }`}
            >
              <AppText
                  variant="small"
                  style={{
                    color: selected ? '#FFFFFF' : '#777770',
                    fontWeight: selected ? '600' : '500',
                  }}
                >
                  {option.label}
                </AppText>
            </Pressable>
          );
        })}
      </View>
    );
  }
);
