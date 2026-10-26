import { Stack } from 'expo-router';

import { AppHeader } from '@/components/layout';

export default function SupplierLayout() {
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
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="new"
        options={{
          header: () => (
            <AppHeader
              title="New Supplier"
              showBack
              className="bg-background px-5"
            />
          ),
        }}
      />

      <Stack.Screen
        name="[id]/index"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="[id]/supply"
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      <Stack.Screen
        name="[id]/payment"
        options={{ headerShown: false }}
      />

      {/* Supplier products list */}
      <Stack.Screen
        name="[id]/products/index"
        options={{ headerShown: false }}
      />

      {/* Add supplier product */}
      <Stack.Screen
        name="[id]/products/add"
        options={{ headerShown: false }}
      />

      {/* Edit supplier product */}
      <Stack.Screen
        name="[id]/products/[productId]"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}