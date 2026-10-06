import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppText } from '@/components/ui';

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
  onBackPress?: () => void;
  className?: string;
}

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  right,
  onBackPress,
  className = '',
}: AppHeaderProps) {
  function handleBack() {
    if (onBackPress) {
      onBackPress();
      return;
    }

    router.back();
  }

  return (
    <View
      className={`
        min-h-16
        flex-row
        items-center
        ${className}
      `}
    >
      {showBack ? (
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="
            -ml-2
            mr-1
            h-11
            w-11
            items-center
            justify-center
            rounded-full
            active:bg-chip
          "
        >
          <Ionicons
            name="chevron-back"
            size={26}
            color="#181816"
          />
        </Pressable>
      ) : null}

      <View className="min-w-0 flex-1">
        <AppText
          variant="heading"
          numberOfLines={1}
        >
          {title}
        </AppText>

        {subtitle ? (
          <AppText
            variant="caption"
            numberOfLines={1}
            className="mt-0.5"
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {right ? (
        <View className="ml-3 flex-row items-center">
          {right}
        </View>
      ) : null}
    </View>
  );
}