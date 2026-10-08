
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';

interface AddCustomerButtonProps {
  onPress: () => void;
}

export function AddCustomerButton({
  onPress,
}: AddCustomerButtonProps) {
  return (
    <View className="pb-3 pt-3">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Add customer"
        className="min-h-[64px] flex-row items-center justify-center rounded-[16px] bg-primary px-6 active:opacity-75"
      >
        <Ionicons
          name="person-add-outline"
          size={22}
          color="#FFFFFF"
        />

        <AppText className="ml-3 font-spline-semibold text-[18px] text-inverse">
          + Customer
        </AppText>
      </Pressable>
    </View>
  );
}
