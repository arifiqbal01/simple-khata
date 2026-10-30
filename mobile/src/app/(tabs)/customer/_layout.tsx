
import { Stack } from 'expo-router';

export default function CustomerLayout() {
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
      {/* Customer list */}
      <Stack.Screen name="index" />

      {/* Create customer */}
      <Stack.Screen name="new" />

      {/* Customer ledger */}
      <Stack.Screen name="[id]/index" />

      {/* Add Udhaar */}
      <Stack.Screen
        name="[id]/udhaar"
        options={{
          gestureEnabled: false,
        }}
      />

      {/* Receive payment */}
      <Stack.Screen name="[id]/payment" />
    </Stack>
  );
}
