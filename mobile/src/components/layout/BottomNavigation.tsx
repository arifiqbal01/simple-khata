import React from 'react';
import {
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';

interface TabDefinition {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}

const tabs: Record<string, TabDefinition> = {
  index: {
    label: 'Home',
    icon: 'home-outline',
    activeIcon: 'home',
  },

  customers: {
    label: 'Customers',
    icon: 'people-outline',
    activeIcon: 'people',
  },
};

export function BottomNavigation({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const activeRoute = state.routes[state.index];

  // Customer ledger / forms should not have the
  // root tab bar.
  if (!tabs[activeRoute.name]) {
    return null;
  }

  const visibleRoutes = state.routes.filter(
    (route) => tabs[route.name]
  );

  return (
    <View
      className="border-t border-border bg-surface"
      style={{
        paddingBottom: Math.max(
          insets.bottom,
          4
        ),
      }}
    >
      <View className="flex-row px-6 pt-1">
        {visibleRoutes.map((route) => {
          const routeIndex =
            state.routes.findIndex(
              (item) => item.key === route.key
            );

          const isFocused =
            state.index === routeIndex;

          const definition = tabs[route.name];
          const descriptor =
            descriptors[route.key];

          function handlePress() {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (
              !isFocused &&
              !event.defaultPrevented
            ) {
              navigation.navigate(
                route.name,
                route.params
              );
            }
          }

          function handleLongPress() {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          }

          const accessibilityLabel =
            descriptor.options
              .tabBarAccessibilityLabel ??
            definition.label;

          return (
            <Pressable
              key={route.key}
              onPress={handlePress}
              onLongPress={handleLongPress}
              accessibilityRole="button"
              accessibilityState={
                isFocused
                  ? { selected: true }
                  : {}
              }
              accessibilityLabel={
                accessibilityLabel
              }
              className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-control active:bg-chip"
            >
              <Ionicons
                name={
                  isFocused
                    ? definition.activeIcon
                    : definition.icon
                }
                size={20}
                color={
                  isFocused
                    ? '#181816'
                    : '#9A9A93'
                }
              />

              <AppText
                className={
                  isFocused
                    ? 'font-spline-semibold text-[13px] text-foreground'
                    : 'font-spline-medium text-[13px] text-subtle'
                }
              >
                {definition.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}