import React from 'react';
import {
  FlatList,
  type FlatListProps,
} from 'react-native';

import type { CustomerWithBalance } from '@/repositories/customer';

import { CustomerRow } from './CustomerRow';

export interface CustomerListProps
  extends Omit<
    FlatListProps<CustomerWithBalance>,
    'data' | 'renderItem' | 'keyExtractor'
  > {
  customers: CustomerWithBalance[];
  onQuickUdhaar: (customerId: string) => void;
  onOpenCustomer: (customerId: string) => void;
}

export function CustomerList({
  customers,
  onQuickUdhaar,
  onOpenCustomer,
  ...props
}: CustomerListProps) {
  return (
    <FlatList
      {...props}
      data={customers}
      keyExtractor={(customer) => customer.id}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      renderItem={({ item, index }) => (
        <CustomerRow
          customer={item}
          first={index === 0}
          last={index === customers.length - 1}
          onQuickUdhaar={() =>
            onQuickUdhaar(item.id)
          }
          onOpenCustomer={() =>
            onOpenCustomer(item.id)
          }
        />
      )}
    />
  );
}