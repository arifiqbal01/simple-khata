
import React from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { AppHeader } from '@/components/layout';
import { Screen } from '@/components/ui';
import { PartyForm } from '@/components/party/PartyForm';

export default function NewCustomerScreen() {
  return (
    <Screen>
      <AppHeader
        title="Add Customer"
        showBack
        onBackPress={() => router.back()}
      />

      <View className="flex-1">
        <PartyForm partyType="CUSTOMER" />
      </View>
    </Screen>
  );
}
