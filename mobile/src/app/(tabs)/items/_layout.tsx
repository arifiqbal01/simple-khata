
import { Stack } from 'expo-router';

import { AppHeader } from '@/components/layout';

export default function ItemsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: '#F7F7F5',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="new"
        options={{
          header: () => (
            <AppHeader
              title="New Item"
              showBack
              className="bg-background px-5"
            />
          ),
        }}
      />

      <Stack.Screen
        name="[id]/index"
        options={{
          header: () => (
            <AppHeader
              title="Edit Item"
              showBack
              className="bg-background px-5"
            />
          ),
        }}
      />
    </Stack>
  );
}
