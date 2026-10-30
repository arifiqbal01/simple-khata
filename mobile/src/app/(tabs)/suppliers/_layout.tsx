
import { Stack } from 'expo-router';

export default function SupplierLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: '#F7F7F5',
        },
      }}
    >
      {/* Supplier list */}
      <Stack.Screen name="index" />

      {/* Create supplier */}
      <Stack.Screen name="new" />

      {/* Supplier ledger */}
      <Stack.Screen name="[id]/index" />

      {/* Record supply */}
      <Stack.Screen
        name="[id]/supply"
        options={{
          gestureEnabled: false,
        }}
      />

      {/* Record payment */}
      <Stack.Screen name="[id]/payment" />

      {/* Supplier products list */}
      <Stack.Screen name="[id]/products/index" />

      {/* Add supplier product */}
      <Stack.Screen name="[id]/products/add" />

      {/* Edit supplier product */}
      <Stack.Screen name="[id]/products/[productId]" />
    </Stack>
  );
}
