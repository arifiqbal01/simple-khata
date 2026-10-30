
import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { formatRupees } from '@/utils/ledger/format-rupees';

import { EntryItemRepository } from '@/repositories/item/entry-item';

import type { EntryItem } from '@/types/domain';

import type {
  LedgerHistoryWithBalance,
} from '@/repositories/ledger/ledger-history';

export interface LedgerRowProps {
  entry: LedgerHistoryWithBalance;
  selected?: boolean;
  onPress?: () => void;
  onDelete?: (
    entry: LedgerHistoryWithBalance
  ) => void | Promise<void>;
  isDeleting?: boolean;
}

const itemRepository = new EntryItemRepository();

const COLORS = {
  ink: '#20211F',
  muted: '#777973',
  subtle: '#969892',
  border: '#E8E9E6',
  receipt: '#F7F8F6',
  positive: '#D94D49',
  payment: '#23865C',
  danger: '#C94D47',
  dangerBorder: '#F0D5D2',
};

function money(value: number): string {
  return `Rs ${formatRupees(value)}`;
}

export function LedgerRow({
  entry,
  selected = false,
  onPress,
  onDelete,
  isDeleting = false,
}: LedgerRowProps) {
  const [items, setItems] = useState<EntryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] =
    useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const isPayment = entry.type === 'PAYMENT';
  const title = getEntryTitle(entry);

  const hasBalance =
    typeof entry.balance_after === 'number' &&
    Number.isFinite(entry.balance_after);

  const amountColor = isPayment
    ? COLORS.payment
    : COLORS.positive;

  useEffect(() => {
    if (!selected || isPayment) {
      return;
    }

    let cancelled = false;

    async function loadItems(): Promise<void> {
      setLoadingItems(true);
      setItemsError(null);
      setItems([]);

      try {
        const result = await itemRepository.listByEntry(
          entry.id
        );

        if (!cancelled) {
          setItems(result);
        }
      } catch (error) {
        if (!cancelled) {
          setItemsError(
            error instanceof Error
              ? error.message
              : 'Could not load item details'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingItems(false);
        }
      }
    }

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [entry.id, selected, isPayment, retryKey]);

  function handleDelete(): void {
    if (!onDelete || isDeleting) {
      return;
    }

    void onDelete(entry);
  }

  return (
    <View className="border-b border-border bg-background">
      {/* Collapsed transaction header */}
      <Pressable
        onPress={onPress}
        disabled={!onPress || isDeleting}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${money(entry.amount)}`}
        accessibilityState={{
          selected,
          expanded: selected,
          disabled: !onPress || isDeleting,
        }}
        className="min-h-[76px] flex-row items-center gap-3 py-3"
      >
        <View className="min-w-0 flex-1">
          <AppText
            numberOfLines={selected ? 3 : 2}
            className="font-spline-semibold text-[15px] leading-[21px] text-foreground"
          >
            {title}
          </AppText>

          <AppText
            numberOfLines={1}
            className="mt-1 font-sans text-[11px] leading-[16px] text-muted"
          >
            {formatEntryDateTime(entry.occurred_at)}
          </AppText>
        </View>

        <View className="items-end">
          <AppText
            numberOfLines={1}
            className="font-spline-semibold text-[17px] leading-[23px]"
            style={{ color: amountColor }}
          >
            {isPayment ? '−' : '+'} {money(entry.amount)}
          </AppText>

          <View className="mt-1 flex-row items-center gap-1.5">
            {hasBalance ? (
              <AppText className="font-sans text-[11px] text-muted">
                Bal {money(entry.balance_after)}
              </AppText>
            ) : null}

            <Ionicons
              name={selected ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={COLORS.muted}
            />
          </View>
        </View>
      </Pressable>

      {/* Expanded receipt */}
      {selected ? (
        <View className="pb-3">
          <View
            className="overflow-hidden rounded-xl border"
            style={{
              backgroundColor: COLORS.receipt,
              borderColor: COLORS.border,
            }}
          >
            {!isPayment ? (
              <View className="px-3.5 pt-3">
                <View className="mb-1.5 flex-row items-center justify-between">
                  <AppText
                    className="font-spline-semibold text-[11px] uppercase tracking-wide"
                    style={{ color: COLORS.muted }}
                  >
                    Items
                  </AppText>

                  {!loadingItems &&
                  !itemsError &&
                  items.length > 0 ? (
                    <AppText
                      className="font-sans text-[11px]"
                      style={{ color: COLORS.subtle }}
                    >
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </AppText>
                  ) : null}
                </View>

                {loadingItems ? (
                  <View className="flex-row items-center gap-2 py-4">
                    <ActivityIndicator
                      size="small"
                      color={COLORS.muted}
                    />
                    <AppText className="text-[12px] text-muted">
                      Loading item details...
                    </AppText>
                  </View>
                ) : itemsError ? (
                  <View className="py-3">
                    <AppText className="text-[12px] text-udhaar">
                      {itemsError}
                    </AppText>

                    <Pressable
                      onPress={() =>
                        setRetryKey((value) => value + 1)
                      }
                      className="mt-2 self-start"
                    >
                      <AppText className="font-spline-semibold text-[12px] text-foreground">
                        Retry
                      </AppText>
                    </Pressable>
                  </View>
                ) : items.length > 0 ? (
                  items.map((item, index) => (
                    <ItemDetailRow
                      key={item.id}
                      item={item}
                      isLast={index === items.length - 1}
                    />
                  ))
                ) : (
                  <AppText className="py-3 text-[12px] text-muted">
                    No item details recorded.
                  </AppText>
                )}
              </View>
            ) : null}

            {entry.note?.trim() ? (
              <View className="px-3.5 pb-3 pt-2">
                <AppText
                  className="text-[11px]"
                  style={{ color: COLORS.muted }}
                >
                  Note
                </AppText>

                <AppText className="mt-1 text-[13px] text-foreground">
                  {entry.note.trim()}
                </AppText>
              </View>
            ) : null}

            {/* Totals */}
            <View
              className="mx-3.5 border-t pt-3"
              style={{ borderColor: COLORS.border }}
            >
              <View className="flex-row items-center justify-between gap-3">
                <AppText className="font-spline-semibold text-[13px] text-foreground">
                  {isPayment
                    ? 'Payment Amount'
                    : 'Transaction Total'}
                </AppText>

                <AppText className="font-spline-semibold text-[16px] text-foreground">
                  {money(entry.amount)}
                </AppText>
              </View>

              {hasBalance ? (
                <View className="mt-2 flex-row items-center justify-between gap-3">
                  <AppText
                    className="text-[12px]"
                    style={{ color: COLORS.muted }}
                  >
                    Balance After
                  </AppText>

                  <AppText className="font-spline-semibold text-[13px] text-foreground">
                    {money(entry.balance_after)}
                  </AppText>
                </View>
              ) : null}
            </View>

            {/* Delete action */}
            {onDelete ? (
              <View className="items-end px-3.5 pb-3 pt-3">
                <Pressable
                  onPress={handleDelete}
                  disabled={isDeleting}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${getEntryTypeLabel(entry.type)} of ${money(entry.amount)}`}
                  accessibilityState={{
                    disabled: isDeleting,
                    busy: isDeleting,
                  }}
                  className="min-h-[34px] flex-row items-center justify-center gap-1.5 rounded-lg border px-3"
                  style={{
                    borderColor: COLORS.dangerBorder,
                    opacity: isDeleting ? 0.45 : 1,
                  }}
                >
                  {isDeleting ? (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.danger}
                    />
                  ) : (
                    <Ionicons
                      name="trash-outline"
                      size={14}
                      color={COLORS.danger}
                    />
                  )}

                  <AppText
                    className="font-spline-semibold text-[12px]"
                    style={{ color: COLORS.danger }}
                  >
                    Delete
                  </AppText>
                </Pressable>
              </View>
            ) : (
              <View className="pb-3" />
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ItemDetailRow({
  item,
  isLast,
}: {
  item: EntryItem;
  isLast: boolean;
}) {
  const quantity = item.quantity?.trim();
  const unit = item.unit?.trim();

  const hasPrice =
    typeof item.unit_price === 'number' &&
    Number.isFinite(item.unit_price);

  const hasAmount =
    typeof item.amount === 'number' &&
    Number.isFinite(item.amount);

  const quantityText = [quantity, unit]
    .filter(Boolean)
    .join(' ');

  const priceText = hasPrice
    ? `${money(item.unit_price!)}${unit ? `/${unit}` : '/unit'}`
    : null;

  const detailsText = [
    quantityText || null,
    priceText,
  ]
    .filter(Boolean)
    .join('  ×  ');

  return (
    <View
      className={`flex-row items-center justify-between gap-3 py-2.5 ${
        isLast ? '' : 'border-b'
      }`}
      style={{
        borderColor: COLORS.border,
      }}
    >
      <View className="min-w-0 flex-1">
        <AppText
          numberOfLines={2}
          className="font-spline-semibold text-[13px] leading-[18px] text-foreground"
        >
          {item.name}
        </AppText>

        {detailsText ? (
          <AppText
            numberOfLines={2}
            className="mt-0.5 font-sans text-[11px] leading-[16px]"
            style={{ color: COLORS.muted }}
          >
            {detailsText}
          </AppText>
        ) : null}
      </View>

      <AppText
        numberOfLines={1}
        className="font-spline-semibold text-[13px] text-foreground"
      >
        {hasAmount ? money(item.amount!) : '—'}
      </AppText>
    </View>
  );
}

function getEntryTypeLabel(
  type: LedgerHistoryWithBalance['type']
): string {
  switch (type) {
    case 'UDHAAR':
      return 'Udhaar';
    case 'SUPPLY':
      return 'Supply';
    case 'PAYMENT':
      return 'Payment';
    default:
      return 'Transaction';
  }
}

function getEntryTitle(
  entry: LedgerHistoryWithBalance
): string {
  if (entry.type === 'PAYMENT') {
    return 'Payment';
  }

  return (
    entry.item_names?.trim() ||
    getEntryTypeLabel(entry.type)
  );
}

function formatEntryDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const formattedDate = date.toLocaleDateString(
    'en-PK',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );

  const formattedTime = date.toLocaleTimeString(
    'en-PK',
    {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }
  );

  return `${formattedDate} · ${formattedTime}`;
}
