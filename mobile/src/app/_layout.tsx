import '../../global.css';

import React, {
  useEffect,
  useState,
} from 'react';

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

import {
  ActivityIndicator,
  View,
} from 'react-native';

import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';

import { toastConfig } from '@/components/ui/toastConfig';
import { BackupLifecycle } from '@/components/backup/BackupLifecycle';
import { SyncLifecycle } from '@/components/sync';
import { runMigrations } from '@/db/migrations';

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
        // Complete all SQLite migrations before
        // mounting app screens or starting sync.
        await runMigrations();

        if (cancelled) {
          return;
        }

        setDatabaseReady(true);
      } catch (cause) {
        if (cancelled) {
          return;
        }

        const normalizedError =
          cause instanceof Error
            ? cause
            : new Error(String(cause));

        console.error(
          '[RootLayout] Database initialization failed:',
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
        <StatusBar
          style="dark"
          backgroundColor="#F8F8F6"
          translucent={false}
        />

        <ActivityIndicator
          size="large"
          color="#242422"
        />
      </View>
    );
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar
        style="dark"
        backgroundColor="#F8F8F6"
        translucent={false}
      />

      {/*
       * Check whether an automatic SQLite backup
       * is due after database migrations complete.
       *
       * BackupLifecycle checks on mount and when
       * the app returns to the foreground.
       */}
      <BackupLifecycle />

      {/*
       * Start sync only after database migrations.
       *
       * Note: BackupLifecycle and SyncLifecycle
       * can run concurrently. This does not
       * guarantee backup completion before sync.
       */}
      <SyncLifecycle />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: '#F7F7F5',
          },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="bootstrap"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
      </Stack>

      <Toast
        config={toastConfig}
        topOffset={55}
      />
    </ThemeProvider>
  );
}
