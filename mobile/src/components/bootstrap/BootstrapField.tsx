
import React from 'react';
import { TextInput, View } from 'react-native';

import { AppText } from '@/components/ui';

interface BootstrapFieldProps {
  label: string;
  value: string;
  placeholder: string;
  editable?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences';
  onChangeText: (value: string) => void;
}

export function BootstrapField({
  label,
  value,
  placeholder,
  editable = true,
  autoCapitalize = 'words',
  onChangeText,
}: BootstrapFieldProps) {
  return (
    <View className="mb-5">
      <AppText className="mb-2 text-sm font-spline-medium text-neutral-700">
        {label}
      </AppText>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        className="h-14 rounded-2xl border border-neutral-200 bg-white px-4 text-base text-neutral-950"
      />
    </View>
  );
}
