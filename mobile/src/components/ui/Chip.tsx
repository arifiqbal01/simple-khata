import React from 'react';
import {
  Pressable,
  type PressableProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from './AppText';

export interface ChipProps
  extends Omit<PressableProps, 'children'> {
  label: string;
  selected?: boolean;
  className?: string;
}

export function Chip({
  label,
  selected = false,
  disabled = false,
  className = '',
  ...props
}: ChipProps) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{
        selected,
        disabled: disabled ?? false,
      }}
      className={`
        min-h-11
        flex-row
        items-center
        justify-center
        rounded-full
        px-4
        ${
          selected
            ? 'bg-primary'
            : 'bg-chip'
        }
        ${
          disabled
            ? 'opacity-40'
            : 'active:opacity-70'
        }
        ${className}
      `}
    >
      {selected ? (
        <Ionicons
          name="checkmark"
          size={18}
          color="#FFFFFF"
          style={{ marginRight: 6 }}
        />
      ) : null}

      <AppText
        className={`
          font-spline-medium
          text-[16px]
          leading-[22px]
          ${
            selected
              ? 'text-white'
              : 'text-foreground'
          }
        `}
      >
        {label}
      </AppText>
    </Pressable>
  );
}