
import React, { useState } from 'react';

import {
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { ITEM_UNITS } from '@/config/item-units';

export interface ItemUnitPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  optional?: boolean;
  label?: string;
  compact?: boolean;
}

export function ItemUnitPicker({
  value,
  onChange,
  disabled = false,
  optional = false,
  label = 'Unit',
  compact = false,
}: ItemUnitPickerProps) {
  const [visible, setVisible] = useState(false);

  const selectedUnit = ITEM_UNITS.find(
    (unit) => unit.value === value
  );

  const selectedLabel =
    selectedUnit?.label ||
    (value
      ? value
      : optional
        ? 'Select unit (optional)'
        : 'Select unit');

  const selectUnit = (unit: string) => {
    onChange(unit);
    setVisible(false);
  };

  return (
    <View>
      {!compact ? (
        <AppText className="mb-2 font-spline-semibold text-[14px] text-foreground">
          {label}
        </AppText>
      ) : null}

      <Pressable
        onPress={() => setVisible(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Select ${label.toLowerCase()}`}
        accessibilityState={{ disabled }}
        className={`flex-row items-center justify-between rounded-xl border border-border bg-surface ${
          compact
            ? 'h-11 px-3'
            : 'min-h-[52px] px-4'
        }`}
      >
        <AppText
          numberOfLines={1}
          className={`flex-1 ${
            compact ? 'text-[14px]' : 'text-[16px]'
          } ${
            value
              ? 'text-foreground'
              : 'text-muted'
          }`}
        >
          {value
            ? selectedLabel
            : compact
              ? 'Unit'
              : selectedLabel}
        </AppText>

        <Ionicons
          name="chevron-down"
          size={compact ? 15 : 18}
          color="#9A9A93"
        />
      </Pressable>

      {optional && !compact ? (
        <AppText className="mt-2 text-[12px] text-muted">
          Optional. Choose how this item is sold.
        </AppText>
      ) : null}

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable
            className="flex-1"
            onPress={() => setVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close unit picker"
          />

          <View className="max-h-[75%] rounded-t-[24px] bg-background px-5 pb-8 pt-5">
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="font-spline-bold text-[19px] text-foreground">
                Select Unit
              </AppText>

              <Pressable
                onPress={() => setVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close unit picker"
                hitSlop={10}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color="#242422"
                />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {optional ? (
                <Pressable
                  onPress={() => selectUnit('')}
                  className="min-h-[52px] flex-row items-center justify-between border-b border-border py-3"
                >
                  <AppText className="text-[15px] text-muted">
                    No unit
                  </AppText>

                  {!value ? (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color="#242422"
                    />
                  ) : null}
                </Pressable>
              ) : null}

              {value && !selectedUnit ? (
                <Pressable
                  onPress={() => selectUnit(value)}
                  className="min-h-[52px] flex-row items-center justify-between border-b border-border py-3"
                >
                  <AppText className="text-[15px] text-foreground">
                    {value} (Existing)
                  </AppText>

                  <Ionicons
                    name="checkmark"
                    size={20}
                    color="#242422"
                  />
                </Pressable>
              ) : null}

              {ITEM_UNITS.map((unit) => {
                const isSelected =
                  value === unit.value;

                return (
                  <Pressable
                    key={unit.value}
                    onPress={() =>
                      selectUnit(unit.value)
                    }
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: isSelected,
                    }}
                    className="min-h-[52px] flex-row items-center justify-between border-b border-border py-3"
                  >
                    <AppText className="text-[15px] text-foreground">
                      {unit.label}
                    </AppText>

                    {isSelected ? (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color="#242422"
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
