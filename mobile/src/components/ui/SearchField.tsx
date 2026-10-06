// src/components/ui/SearchField.tsx

import React from 'react';
import {
  Pressable,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SearchFieldProps
  extends Omit<
    TextInputProps,
    'value' | 'onChangeText'
  > {
  value: string;
  onChangeText: (value: string) => void;
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  ...props
}: SearchFieldProps) {
  return (
    <View
      className="
        min-h-12
        flex-row
        items-center
        rounded-control
        bg-input-background
        px-4
      "
    >
      <Ionicons
        name="search-outline"
        size={20}
        color="#777770"
      />

      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9A9A93"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        className="
          ml-3
          min-w-0
          flex-1
          border-0
          bg-transparent
          py-3
          font-sans
          text-body
          text-foreground
          outline-none
        "
      />

      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-full active:bg-chip"
        >
          <Ionicons
            name="close-circle"
            size={20}
            color="#9A9A93"
          />
        </Pressable>
      ) : null}
    </View>
  );
}