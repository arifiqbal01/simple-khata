
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { formatRupees } from '@/utils/ledger/format-rupees';

export type PartyRowType = 'CUSTOMER' | 'SUPPLIER';

type DateValue = string | number | Date | null;

export interface PartyRowData {
  id: string;
  name: string;
  balance: number;
  type: PartyRowType;

  last_activity_at?: DateValue;
  created_at?: DateValue;
  updated_at?: DateValue;

  lastActivityAt?: DateValue;
  createdAt?: DateValue;
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

function parseDate(
  value: DateValue | undefined
): Date | null {
  if (value == null || value === '') {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : typeof value === 'number'
        ? new Date(
            value < 1_000_000_000_000
              ? value * 1000
              : value
          )
        : new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function formatLastActivity(
  party: PartyRowData
): string | null {
  const value =
    party.last_activity_at ??
    party.lastActivityAt ??
    party.created_at ??
    party.createdAt;

  const date = parseDate(value);

  if (!date) {
    return null;
  }

  const now = new Date();

  const isCurrentYear =
    date.getFullYear() === now.getFullYear();

  const dateText = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(!isCurrentYear
      ? { year: 'numeric' as const }
      : {}),
  });

  const timeText = date
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase();

  return `${dateText} · ${timeText}`;
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

  const lastActivity = useMemo(
    () => formatLastActivity(party),
    [
      party.last_activity_at,
      party.lastActivityAt,
      party.created_at,
      party.createdAt,
    ]
  );

  const amountColor = isSupplier
    ? '#DC2626'
    : '#15803D';

  return (
    <View
      className={`
        min-h-[64px]
        flex-row
        items-center
        border-border
        px-3
        ${selected ? 'bg-chip' : 'bg-surface'}
        ${first ? 'rounded-t-[16px]' : ''}
        ${last ? 'rounded-b-[16px]' : ''}
        ${!last ? 'border-b' : ''}
      `}
    >
      <Pressable
        onPress={onOpenParty}
        onLongPress={onLongPressParty}
        delayLongPress={400}
        disabled={isDeleting}
        accessibilityRole="button"
        accessibilityLabel={`Open ${party.name}${
          lastActivity
            ? `, last activity ${lastActivity}`
            : ''
        }`}
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

        <View className="ml-2.5 min-w-0 flex-1">
          <AppText
            numberOfLines={1}
            style={{
              fontSize: 14,
              lineHeight: 19,
            }}
            className="
              font-spline-semibold
              text-foreground
            "
          >
            {party.name}
          </AppText>

          {lastActivity ? (
            <AppText
              numberOfLines={1}
              ellipsizeMode="tail"
              allowFontScaling={false}
              style={{
                fontSize: 10,
                lineHeight: 15,
                color: '#85857F',
                marginTop: 2,
              }}
            >
              {lastActivity}
            </AppText>
          ) : null}
        </View>

        <View className="ml-2 max-w-[46%] items-end">
          <AppText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{
              color: amountColor,
              fontSize: 14,
              lineHeight: 20,
            }}
            className="font-spline-semibold"
          >
            Rs {formatRupees(party.balance)}
          </AppText>
        </View>
      </Pressable>

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
            ml-1
            h-8
            w-8
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
          ml-2
          h-8
          w-8
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
          size={17}
          color="#242422"
        />
      </Pressable>
    </View>
  );
}
