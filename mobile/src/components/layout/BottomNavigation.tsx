
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

  customer: {
    label: 'Customers',
    icon: 'people-outline',
    activeIcon: 'people',
  },

  suppliers: {
    label: 'Suppliers',
    icon: 'business-outline',
    activeIcon: 'business',
  },

  items: {
    label: 'Items',
    icon: 'cube-outline',
    activeIcon: 'cube',
  },
};

export function BottomNavigation({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const activeRoute = state.routes[state.index];

  if (!activeRoute || !tabs[activeRoute.name]) {
    return null;
  }

  const visibleRoutes = state.routes.filter(
    (route) => Boolean(tabs[route.name])
  );

  return (
    <View
      className="border-t border-border bg-surface"
      style={{
        paddingBottom: Math.max(insets.bottom, 4),
      }}
    >
      <View className="flex-row px-3 pb-1 pt-2">
        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.findIndex(
            (item) => item.key === route.key
          );

          const isFocused =
            state.index === routeIndex;

          const definition = tabs[route.name];
          const descriptor = descriptors[route.key];

          function handlePress() {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (event.defaultPrevented) {
              return;
            }

            /*
             * Always open the root list screen
             * for tabs with nested stacks.
             *
             * This prevents the Customers tab
             * from reopening Udhaar or a ledger.
             */
            if (
              route.name === 'customer' ||
              route.name === 'suppliers' ||
              route.name === 'items'
            ) {
              navigation.navigate(route.name, {
                screen: 'index',
                params: {},
              });

              return;
            }

            /*
             * Home is a direct tab screen.
             */
            if (!isFocused) {
              navigation.navigate(route.name);
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
              accessibilityRole="tab"
              accessibilityState={{
                selected: isFocused,
              }}
              accessibilityLabel={
                accessibilityLabel
              }
              accessibilityHint={`Open ${definition.label}`}
              hitSlop={4}
              className="
                min-h-[48px]
                flex-1
                items-center
                justify-center
                rounded-control
                active:bg-chip
              "
            >
              <View
                className={
                  isFocused
                    ? 'h-10 w-14 items-center justify-center rounded-full bg-chip'
                    : 'h-10 w-14 items-center justify-center rounded-full'
                }
              >
                <Ionicons
                  name={
                    isFocused
                      ? definition.activeIcon
                      : definition.icon
                  }
                  size={23}
                  color={
                    isFocused
                      ? '#181816'
                      : '#9A9A93'
                  }
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
