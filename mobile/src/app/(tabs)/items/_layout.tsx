
import { Stack } from 'expo-router';

export default function ItemsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: '#F7F7F5',
        },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]/index" />
    </Stack>
  );
}
