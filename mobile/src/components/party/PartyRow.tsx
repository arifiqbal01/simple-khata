
import React from 'react';

import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { formatRupees } from '@/utils/ledger/format-rupees';

export type PartyRowType = 'CUSTOMER' | 'SUPPLIER';

export interface PartyRowData {
  id: string;
  name: string;
  balance: number;
  type: PartyRowType;
}

export interface PartyRowProps {
  party: PartyRowData;
  first?: boolean;
  last?: boolean;
  selected?: boolean;
  isDeleting?: boolean;

  onOpenParty: () => void;
  onLongPressParty?: () => void;
  onQuickTransaction: () => void;
  onDelete?: () => void;
}

export function PartyRow({
  party,
  first = false,
  last = false,
  selected = false,
  isDeleting = false,
  onOpenParty,
  onLongPressParty,
  onQuickTransaction,
  onDelete,
}: PartyRowProps) {
  const isSupplier = party.type === 'SUPPLIER';

  const amountColor = isSupplier
    ? '#DC2626'
    : '#15803D';

  return (
    <View
      className={`
        min-h-[60px]
        flex-row
        items-center
        border-border
        px-4
        ${selected ? 'bg-chip' : 'bg-surface'}
        ${first ? 'rounded-t-[16px]' : ''}
        ${last ? 'rounded-b-[16px]' : ''}
        ${!last ? 'border-b' : ''}
      `}
    >
      {/* Main party row: tap to open, long-press to select */}
      <Pressable
        onPress={onOpenParty}
        onLongPress={onLongPressParty}
        delayLongPress={400}
        disabled={isDeleting}
        accessibilityRole="button"
        accessibilityLabel={`Open ${party.name}`}
        accessibilityHint={
          onLongPressParty
            ? 'Long press to select this party'
            : undefined
        }
        accessibilityState={{
          selected,
          disabled: isDeleting,
        }}
        className="
          min-w-0
          flex-1
          flex-row
          items-center
          py-3
          active:opacity-70
        "
      >
        <View
          className="
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-full
            bg-chip
          "
        >
          <Ionicons
            name={
              isSupplier
                ? 'business-outline'
                : 'person-outline'
            }
            size={16}
            color="#242422"
          />
        </View>

        <View className="ml-3 min-w-0 flex-1">
          <AppText
            numberOfLines={1}
            className="
              font-spline-semibold
              text-[15px]
              text-foreground
            "
          >
            {party.name}
          </AppText>
        </View>

        <View className="ml-2 shrink-0 items-end">
          <AppText
            numberOfLines={1}
            style={{ color: amountColor }}
            className="
              font-spline-semibold
              text-[15px]
            "
          >
            Rs {formatRupees(party.balance)}
          </AppText>
        </View>
      </Pressable>

      {/* Delete button: visible only for selected parties */}
      {selected && onDelete ? (
        <Pressable
          onPress={onDelete}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${party.name}`}
          accessibilityState={{
            disabled: isDeleting,
            busy: isDeleting,
          }}
          hitSlop={8}
          className="
            ml-2
            h-9
            w-9
            items-center
            justify-center
            rounded-lg
            active:opacity-70
          "
        >
          {isDeleting ? (
            <ActivityIndicator
              size="small"
              color="#DC2626"
            />
          ) : (
            <Ionicons
              name="trash-outline"
              size={16}
              color="#DC2626"
            />
          )}
        </Pressable>
      ) : null}

      {/* Quick transaction button */}
      <Pressable
        onPress={onQuickTransaction}
        disabled={isDeleting}
        accessibilityRole="button"
        accessibilityLabel={
          isSupplier
            ? `Add supply for ${party.name}`
            : `Add udhaar for ${party.name}`
        }
        accessibilityState={{
          disabled: isDeleting,
        }}
        hitSlop={10}
        className="
          ml-3
          h-7
          w-7
          shrink-0
          items-center
          justify-center
          rounded-lg
          bg-chip
          active:opacity-70
        "
      >
        <Ionicons
          name="add"
          size={14}
          color="#242422"
        />
      </Pressable>
    </View>
  );
}
