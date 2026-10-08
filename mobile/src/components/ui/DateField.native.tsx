
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { AppText } from '@/components/ui';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function DateField({ label, value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View className="min-w-0 flex-1">
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className="min-h-16 justify-center rounded-xl border border-border bg-surface px-3"
      >
        <AppText className="text-[12px] text-muted">
          {label}
        </AppText>

        <AppText className="mt-1 text-[14px] text-foreground">
          {parseDate(value).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </AppText>
      </Pressable>

      {open ? (
        <DateTimePicker
          value={parseDate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={new Date()}
          onChange={(event, selectedDate) => {
            if (Platform.OS === 'android') {
              setOpen(false);
            }

            if (event.type === 'set' && selectedDate) {
              onChange(dateKey(selectedDate));
            }
          }}
        />
      ) : null}

      {open && Platform.OS === 'ios' ? (
        <Pressable onPress={() => setOpen(false)} className="py-2">
          <AppText className="text-center text-foreground">
            Done
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
