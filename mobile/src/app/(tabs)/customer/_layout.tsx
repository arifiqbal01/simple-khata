import { Stack } from 'expo-router';

import { AppHeader } from '@/components/layout';

export default function CustomerLayout() {
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
        name="new"
        options={{
          header: () => (
            <AppHeader
              title="New Customer"
              showBack
              className="bg-background px-5"
            />
          ),
        }}
      />

      <Stack.Screen
        name="[id]/index"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
          name="[id]/udhaar"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />

      <Stack.Screen
        name="[id]/payment"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}