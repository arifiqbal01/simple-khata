
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
      {/* Customer list */}
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />

      {/* Create customer */}
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

      {/* Customer ledger */}
      <Stack.Screen
        name="[id]/index"
        options={{
          headerShown: false,
        }}
      />

      {/* Add Udhaar */}
      <Stack.Screen
        name="[id]/udhaar"
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      {/* Receive payment */}
      <Stack.Screen
        name="[id]/payment"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
