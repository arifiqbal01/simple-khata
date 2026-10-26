
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { BootstrapMode } from '@/hooks/bootstrap/useBootstrap';

interface BootstrapModeSelectorProps {
  mode: BootstrapMode;
  disabled?: boolean;
  onChange: (mode: BootstrapMode) => void;
}

export function BootstrapModeSelector({
  mode,
  disabled = false,
  onChange,
}: BootstrapModeSelectorProps) {
  return (
    <View className="mb-8 flex-row rounded-2xl bg-neutral-100 p-1">
      {(
        [
          { value: 'create', label: 'Create shop' },
          { value: 'join', label: 'Join shop' },
        ] as const
      ).map((option) => {
        const selected = mode === option.value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{
              selected,
              disabled,
            }}
            className={`flex-1 items-center rounded-xl px-3 py-3 ${
              selected ? 'bg-white' : 'bg-transparent'
            }`}
          >
            <AppText
              className={`text-sm font-spline-semibold ${
                selected
                  ? 'text-neutral-950'
                  : 'text-neutral-500'
              }`}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
