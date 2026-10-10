
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { AppText, Button } from '@/components/ui';
import { DateField } from '@/components/ui/DateField';

import type {
  TransactionDateFilter,
  TransactionFilterState,
} from '@/hooks/ledger/useCustomerTransactions';

interface Props {
  filter: TransactionFilterState;
  onChange: (filter: TransactionFilterState) => void;
}

const FILTERS: {
  type: TransactionDateFilter;
  label: string;
}[] = [
  { type: 'recent', label: 'All' },
  { type: 'today', label: 'Today' },
  { type: 'yesterday', label: 'Yesterday' },
  { type: 'custom', label: 'Custom' },
];

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );
}

export function TransactionFilters({
  filter,
  onChange,
}: Props) {
  const [customOpen, setCustomOpen] = useState(false);

  const [customFrom, setCustomFrom] = useState(
    () => filter.from ?? dateKey(new Date())
  );

  const [customTo, setCustomTo] = useState(
    () => filter.to ?? dateKey(new Date())
  );

  function selectFilter(type: TransactionDateFilter) {
    if (type === 'custom') {
      setCustomOpen((current) => !current);
      return;
    }

    setCustomOpen(false);
    onChange({ type });
  }

  function applyDates() {
    if (!customFrom || !customTo || customFrom > customTo) {
      Toast.show({
        type: 'error',
        text1: 'Invalid date range',
        text2: 'Select valid dates, with From before To.',
      });
      return;
    }

    onChange({
      type: 'custom',
      from: customFrom,
      to: customTo,
    });

    setCustomOpen(false);
  }

  return (
    <View>
      {/* Single-row transaction filters */}
      <View className="mt-4 flex-row gap-1.5">
        {FILTERS.map((option) => {
          const selected =
            option.type === 'custom'
              ? customOpen || filter.type === 'custom'
              : !customOpen && filter.type === option.type;

          return (
            <Pressable
              key={option.type}
              onPress={() => selectFilter(option.type)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`min-h-10 min-w-0 flex-1 items-center justify-center rounded-full px-1 ${
                selected ? 'bg-black' : 'bg-chip'
              }`}
            >
              <AppText
                numberOfLines={1}
                className={`font-spline-medium text-[12px] ${
                  selected
                    ? 'text-white'
                    : 'text-foreground'
                }`}
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* Custom date range picker */}
      {customOpen ? (
        <View className="mt-4 rounded-2xl border border-border bg-surface p-4">
          <AppText className="font-spline-semibold text-[15px] text-foreground">
            Select date range
          </AppText>

          <View className="mt-4 flex-row gap-3">
            <DateField
              label="From"
              value={customFrom}
              onChange={setCustomFrom}
            />

            <DateField
              label="To"
              value={customTo}
              onChange={setCustomTo}
            />
          </View>

          <Button
            label="Apply dates"
            onPress={applyDates}
            className="mt-4 min-h-12"
          />
        </View>
      ) : filter.type === 'custom' &&
        filter.from &&
        filter.to ? (
        <AppText className="mt-3 text-[12px] text-muted">
          {formatDate(filter.from)} – {formatDate(filter.to)}
        </AppText>
      ) : null}
    </View>
  );
}
