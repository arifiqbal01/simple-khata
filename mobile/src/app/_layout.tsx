import '../../global.css';

import {
  SplineSans_400Regular,
  SplineSans_500Medium,
  SplineSans_600SemiBold,
  SplineSans_700Bold,
  useFonts,
} from '@expo-google-fonts/spline-sans';
import {
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import React, {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  View,
} from 'react-native';

import { runMigrations } from '@/db/migrations';
import SyncLifecycle from '@/services/sync/SyncLifecycle';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F7F7F5',
    card: '#FFFFFF',
    text: '#181816',
    border: '#E7E7E2',
    primary: '#242422',
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SplineSans_400Regular,
    SplineSans_500Medium,
    SplineSans_600SemiBold,
    SplineSans_700Bold,
  });

  const [databaseReady, setDatabaseReady] =
    useState(false);

  const [databaseError, setDatabaseError] =
    useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initializeDatabase() {
      try {
        await runMigrations();

        if (cancelled) {
          return;
        }

        setDatabaseReady(true);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const normalizedError =
          error instanceof Error
            ? error
            : new Error(String(error));

        console.error(
          'Database initialization failed:',
          normalizedError
        );

        setDatabaseError(normalizedError);
      }
    }

    void initializeDatabase();

    return () => {
      cancelled = true;
    };
  }, []);

  if (fontError) {
    throw fontError;
  }

  if (databaseError) {
    throw databaseError;
  }

  if (!fontsLoaded || !databaseReady) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <SyncLifecycle />

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" />

        <Stack.Screen
          name="bootstrap"
          options={{
            gestureEnabled: false,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}