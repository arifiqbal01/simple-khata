
import React from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/ui';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function DateField({ label, value, onChange }: Props) {
  return (
    <View className="min-w-0 flex-1 rounded-xl border border-border bg-surface p-3">
      <AppText className="mb-1 text-[12px] text-muted">
        {label}
      </AppText>

      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        style={{
          width: '100%',
          minWidth: 0,
          fontSize: 14,
          color: '#181816',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      />
    </View>
  );
}
