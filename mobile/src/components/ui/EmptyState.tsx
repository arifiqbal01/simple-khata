// src/components/ui/EmptyState.tsx

import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from './AppText';

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  className = '',
}: EmptyStateProps) {
  return (
    <View
      className={`
        flex-1
        items-center
        justify-center
        px-6
        pb-20
        ${className}
      `}
    >
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-chip">
        <Ionicons
          name={icon}
          size={26}
          color="#181816"
        />
      </View>

      <AppText
        variant="heading"
        className="text-center"
      >
        {title}
      </AppText>

      {description ? (
        <AppText
          variant="small"
          className="mt-2 max-w-[280px] text-center"
        >
          {description}
        </AppText>
      ) : null}
    </View>
  );
}