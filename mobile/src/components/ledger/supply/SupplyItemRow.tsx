
import React, { memo, useMemo, useState } from 'react';

import {
  Platform,
  Pressable,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { ITEM_UNITS } from '@/config/item-units';

import type {
  DraftSupplyItem,
  SupplyEntryMode,
} from '@/hooks/ledger/supply/types';

import {
  calculateAmount,
  calculateQuantity,
  formatCalculatedQuantity,
  parseWholeRupees,
} from '@/utils/ledger/item-calculations';

export interface SupplyItemRowProps {
  item: DraftSupplyItem;
  mode: SupplyEntryMode;

  onRemove: (id: string) => void;

  onChangeAmount: (
    id: string,
    amount: string
  ) => void;

  onChangeQuantity: (
    id: string,
    quantity: string
  ) => void;

  disabled?: boolean;
}

function normalizeWholeRupees(value: string): string {
  return value.replace(/[^\d]/g, '');
}

function normalizeDecimal(value: string): string {
  const cleaned = value
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');

  const dotIndex = cleaned.indexOf('.');

  if (dotIndex === -1) {
    return cleaned;
  }

  return (
    cleaned.slice(0, dotIndex + 1) +
    cleaned.slice(dotIndex + 1).replace(/\./g, '')
  );
}

function formatMoney(value: number): string {
  return `Rs ${value.toLocaleString('en-PK')}`;
}

function getUnitLabel(value: string): string {
  return (
    ITEM_UNITS.find((unit) => unit.value === value)
      ?.label ?? value
  );
}

export const SupplyItemRow = memo(
  function SupplyItemRow({
    item,
    mode,
    onRemove,
    onChangeAmount,
    onChangeQuantity,
    disabled = false,
  }: SupplyItemRowProps) {
    const [detailsVisible, setDetailsVisible] =
      useState(false);

    const [focused, setFocused] =
      useState(false);

    const calculatedAmount = useMemo(
      () =>
        calculateAmount(
          item.quantity,
          item.unitPrice
        ),
      [item.quantity, item.unitPrice]
    );

    const calculatedQuantity = useMemo(() => {
      const quantity = calculateQuantity(
        item.amount,
        item.unitPrice
      );

      return quantity === null
        ? ''
        : formatCalculatedQuantity(quantity);
    }, [item.amount, item.unitPrice]);

    const unitPrice = parseWholeRupees(
      item.unitPrice
    );

    const unitLabel = getUnitLabel(item.unit);

    const invalidAmount =
      mode === 'amount' &&
      item.amount.trim().length > 0 &&
      (
        parseWholeRupees(item.amount) === null ||
        Number(item.amount) <= 0 ||
        !calculatedQuantity
      );

    const invalidQuantity =
      mode === 'quantity' &&
      item.quantity.trim().length > 0 &&
      (
        calculatedAmount === null ||
        calculatedAmount <= 0
      );

    const handlePrimaryChange = (value: string) => {
      if (mode === 'amount') {
        onChangeAmount(
          item.id,
          normalizeWholeRupees(value)
        );
      } else {
        onChangeQuantity(
          item.id,
          normalizeDecimal(value)
        );
      }
    };

    return (
      <View className="rounded-control border border-border bg-background">
        <View className="min-h-[60px] flex-row items-center gap-1 px-2.5 py-2">
          <View className="min-w-0 flex-1">
            <AppText
              variant="bodyMedium"
              numberOfLines={1}
            >
              {item.name}
            </AppText>

            <AppText
              variant="caption"
              className="mt-0.5 text-muted"
              numberOfLines={1}
            >
              {unitLabel}
              {' · '}
              {formatMoney(unitPrice ?? 0)}
              /{unitLabel || 'unit'}
              {mode === 'quantity' &&
              calculatedAmount !== null
                ? ` · ${formatMoney(calculatedAmount)}`
                : ''}
            </AppText>
          </View>

          <View
            className={`h-11 w-[132px] flex-row items-center rounded-xl border bg-surface px-3 ${
              invalidAmount || invalidQuantity
                ? 'border-udhaar'
                : focused
                  ? 'border-border-strong'
                  : 'border-border'
            }`}
          >
            {mode === 'amount' ? (
              <AppText
                variant="small"
                className="mr-2 text-muted"
              >
                Rs
              </AppText>
            ) : null}

            <TextInput
              value={
                mode === 'amount'
                  ? item.amount
                  : item.quantity
              }
              onChangeText={handlePrimaryChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              editable={!disabled && !!item.itemId}
              keyboardType={
                mode === 'amount'
                  ? 'number-pad'
                  : 'decimal-pad'
              }
              inputMode={
                mode === 'amount'
                  ? 'numeric'
                  : 'decimal'
              }
              placeholder={
                mode === 'amount'
                  ? '0'
                  : 'Qty'
              }
              placeholderTextColor="#9A9A93"
              selectionColor="#181816"
              selectTextOnFocus={false}
              underlineColorAndroid="transparent"
              style={
                Platform.OS === 'web'
                  ? ({
                      outlineStyle: 'none',
                    } as unknown as TextStyle)
                  : undefined
              }
              accessibilityLabel={
                mode === 'amount'
                  ? `Amount for ${item.name}`
                  : `Quantity for ${item.name}`
              }
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-right font-sans text-[17px] text-foreground"
            />
          </View>

          <View className="flex-row items-center">
            <Pressable
              onPress={() =>
                setDetailsVisible((current) => !current)
              }
              disabled={disabled}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={
                detailsVisible
                  ? `Hide details for ${item.name}`
                  : `Show details for ${item.name}`
              }
              className="h-9 w-8 items-center justify-center"
            >
              <Ionicons
                name={
                  detailsVisible
                    ? 'chevron-up'
                    : 'information-circle-outline'
                }
                size={18}
                color="#777770"
              />
            </Pressable>

            <Pressable
              onPress={() => onRemove(item.id)}
              disabled={disabled}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.name}`}
              className="h-9 w-8 items-center justify-center"
            >
              <Ionicons
                name="trash-outline"
                size={17}
                color="#777770"
              />
            </Pressable>
          </View>
        </View>

        {detailsVisible ? (
          <View className="gap-2 border-t border-border px-3 py-3">
            <View className="flex-row justify-between gap-3">
              <AppText variant="caption">
                Supplier unit
              </AppText>

              <AppText variant="bodyMedium">
                {unitLabel || 'Not configured'}
              </AppText>
            </View>

            <View className="flex-row justify-between gap-3">
              <AppText variant="caption">
                Supplier unit price
              </AppText>

              <AppText variant="bodyMedium">
                {formatMoney(unitPrice ?? 0)}
              </AppText>
            </View>

            {mode === 'amount' &&
            calculatedQuantity ? (
              <View className="flex-row justify-between gap-3">
                <AppText variant="caption">
                  Calculated quantity
                </AppText>

                <AppText variant="bodyMedium">
                  {calculatedQuantity}
                  {unitLabel ? ` ${unitLabel}` : ''}
                </AppText>
              </View>
            ) : null}

            {mode === 'quantity' &&
            calculatedAmount !== null ? (
              <View className="flex-row justify-between gap-3">
                <AppText variant="caption">
                  Calculated amount
                </AppText>

                <AppText variant="bodyMedium">
                  {formatMoney(calculatedAmount)}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}

        {invalidAmount ? (
          <AppText
            variant="caption"
            className="px-3 pb-2 text-udhaar"
          >
            Enter a positive whole-rupee amount with a
            valid supplier unit price.
          </AppText>
        ) : null}

        {invalidQuantity ? (
          <AppText
            variant="caption"
            className="px-3 pb-2 text-udhaar"
          >
            Enter a positive quantity with at most
            three decimal places.
          </AppText>
        ) : null}
      </View>
    );
  }
);
