import React, {
  memo,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Platform,
  Pressable,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { ItemUnitPicker } from '@/components/item/ItemUnitPicker';
import { ITEM_UNITS } from '@/config/item-units';

import type {
  DraftUdhaarItem,
  UdhaarEntryMode,
} from '@/hooks/ledger/udhaar/types';

import {
  calculateAmount,
  calculateQuantity,
  formatCalculatedQuantity,
  parseLine,
  parseWholeRupees,
} from '@/hooks/ledger/udhaar/utils';

export interface UdhaarItemRowProps {
  item: DraftUdhaarItem;
  mode: UdhaarEntryMode;
  onRemove: (id: string) => void;
  onChangeAmount: (id: string, amount: string) => void;
  onChangeQuantity: (id: string, quantity: string) => void;
  onChangeUnit: (id: string, unit: string) => void;
  onChangeUnitPrice: (id: string, unitPrice: string) => void;
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
  if (!value.trim()) {
    return '';
  }

  return (
    ITEM_UNITS.find((unit) => unit.value === value)
      ?.label ?? value
  );
}

function getShortUnit(value: string): string {
  if (!value.trim()) {
    return '';
  }

  const label = getUnitLabel(value);
  const match = label.match(/\(([^)]+)\)/);

  return match?.[1] ?? value;
}

export const UdhaarItemRow = memo(
  function UdhaarItemRow({
    item,
    mode,
    onRemove,
    onChangeAmount,
    onChangeQuantity,
    onChangeUnit,
    onChangeUnitPrice,
    disabled = false,
  }: UdhaarItemRowProps) {
    const [editingDetails, setEditingDetails] =
      useState(false);
    const [inputFocused, setInputFocused] = useState(false);

    const lineAmount = useMemo(
      () => parseLine(item, mode),
      [item, mode]
    );

    const calculatedAmount = useMemo(() => {
      if (mode !== 'quantity') {
        return null;
      }

      return calculateAmount(
        item.quantity,
        item.unitPrice
      );
    }, [mode, item.quantity, item.unitPrice]);

    const calculatedQuantity = useMemo(() => {
      if (mode !== 'amount') {
        return '';
      }

      const quantity = calculateQuantity(
        item.amount,
        item.unitPrice
      );

      return quantity === null
        ? ''
        : formatCalculatedQuantity(quantity);
    }, [mode, item.amount, item.unitPrice]);

    const shortUnit = getShortUnit(item.unit);
    const unitPrice = parseWholeRupees(
      item.unitPrice
    );

    const missingRequiredDetails =
      mode === 'quantity' &&
      (
        !item.unit.trim() ||
        unitPrice === null
      );

    useEffect(() => {
      if (missingRequiredDetails) {
        setEditingDetails(true);
      }
    }, [missingRequiredDetails]);

    const detailsSummary = useMemo(() => {
      if (
        !item.unit.trim() &&
        !item.unitPrice.trim()
      ) {
        return 'No unit or price';
      }

      if (shortUnit && unitPrice !== null) {
        return `${shortUnit} · ${formatMoney(unitPrice)}/${shortUnit}`;
      }

      if (shortUnit) {
        return shortUnit;
      }

      if (unitPrice !== null) {
        return formatMoney(unitPrice);
      }

      return 'Price not set';
    }, [
      item.unit,
      item.unitPrice,
      shortUnit,
      unitPrice,
    ]);

    const amountValue = parseWholeRupees(
      item.amount
    );

    const invalidAmount =
      mode === 'amount' &&
      item.amount.trim().length > 0 &&
      (
        amountValue === null ||
        amountValue <= 0
      );

    const invalidQuantity =
      mode === 'quantity' &&
      item.quantity.trim().length > 0 &&
      lineAmount === null;

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
        {/* Single compact item row */}
        <View className="min-h-[60px] flex-row items-center gap-1 px-2.5 py-2">
          {/* Name and details */}
          <View className="min-w-0 flex-1">
            <AppText
              variant="bodyMedium"
              numberOfLines={1}
            >
              {item.name.trim() || 'Unnamed item'}
            </AppText>

            <AppText
              variant="caption"
              className="mt-0.5 text-muted"
              numberOfLines={1}
            >
              {mode === 'quantity' &&
              calculatedAmount !== null
                ? `${detailsSummary} · ${formatMoney(calculatedAmount)}`
                : detailsSummary}
            </AppText>
          </View>

          {/* Primary amount / quantity input */}
          <View
            className={`h-11 w-[132px] flex-row items-center rounded-xl border bg-surface px-3 ${
              invalidAmount || invalidQuantity
                ? 'border-udhaar'
                : inputFocused
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
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              editable={!disabled}
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
                  ? ({ outlineStyle: 'none' } as unknown as TextStyle)
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

          {/* Closely grouped edit and remove actions */}
          <View className="flex-row items-center gap-0">
            <Pressable
              onPress={() =>
                setEditingDetails((current) => !current)
              }
              disabled={disabled}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={
                editingDetails
                  ? `Close details for ${item.name}`
                  : `Edit details for ${item.name}`
              }
              accessibilityState={{
                disabled,
                expanded: editingDetails,
              }}
              className="h-9 w-8 items-center justify-center"
            >
              <Ionicons
                name={editingDetails ? 'chevron-up' : 'pencil-outline'}
                size={16}
                color="#777770"
              />
            </Pressable>

            <Pressable
              onPress={() => onRemove(item.id)}
              disabled={disabled}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.name}`}
              accessibilityState={{ disabled }}
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

        {/* Expanded details editor */}
        {editingDetails ? (
          <View className="gap-3 border-t border-border px-3 pb-3 pt-3">
            <View className="flex-row items-end gap-2">
              <View className="min-w-0 flex-1">
                <AppText
                  variant="caption"
                  className="mb-1 text-muted"
                >
                  {mode === 'quantity'
                    ? 'Unit *'
                    : 'Unit (optional)'}
                </AppText>

                <ItemUnitPicker
                  value={item.unit}
                  onChange={(value) =>
                    onChangeUnit(item.id, value)
                  }
                  compact
                  optional={mode === 'amount'}
                  disabled={disabled}
                />
              </View>

              <View className="min-w-0 flex-1">
                <AppText
                  variant="caption"
                  className="mb-1 text-muted"
                >
                  {mode === 'quantity'
                    ? 'Price *'
                    : 'Price (optional)'}
                </AppText>

                <View className="h-11 flex-row items-center rounded-control border border-border bg-surface px-3">
                  <AppText
                    variant="small"
                    className="mr-1 text-muted"
                  >
                    Rs
                  </AppText>

                  <TextInput
                    value={item.unitPrice}
                    onChangeText={(value) =>
                      onChangeUnitPrice(
                        item.id,
                        normalizeWholeRupees(value)
                      )
                    }
                    editable={!disabled}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    placeholder="0"
                    placeholderTextColor="#9A9A93"
                    selectionColor="#181816"
                    accessibilityLabel={`Price for ${item.name}`}
                    className="min-w-0 flex-1 p-0 font-sans text-[14px] text-foreground"
                  />
                </View>
              </View>
            </View>

            {mode === 'amount' &&
            calculatedQuantity ? (
              <AppText
                variant="caption"
                className="text-muted"
              >
                Calculated quantity:{' '}
                {calculatedQuantity}
                {shortUnit
                  ? ` ${shortUnit}`
                  : ''}
              </AppText>
            ) : null}

            {mode === 'quantity' &&
            calculatedAmount !== null ? (
              <View className="flex-row items-center justify-between">
                <AppText
                  variant="caption"
                  className="text-muted"
                >
                  Calculated amount
                </AppText>

                <AppText variant="bodyMedium">
                  {formatMoney(calculatedAmount)}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Validation messages */}
        {invalidAmount ? (
          <AppText
            variant="caption"
            className="px-3 pb-2 text-udhaar"
          >
            Enter a positive whole-rupee amount.
          </AppText>
        ) : null}

        {invalidQuantity ? (
          <AppText
            variant="caption"
            className="px-3 pb-2 text-udhaar"
          >
            Enter a positive quantity, unit and price.
          </AppText>
        ) : null}
      </View>
    );
  }
);