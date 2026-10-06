import React from 'react';
import {
  Pressable,
  type PressableProps,
} from 'react-native';

export interface IconButtonProps
  extends Omit<PressableProps, 'children'> {
  children: React.ReactNode;
  className?: string;
}

export function IconButton({
  children,
  disabled = false,
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={8}
      className={`
        h-11
        w-11
        items-center
        justify-center
        rounded-full
        ${
          disabled
            ? 'opacity-40'
            : 'active:bg-chip'
        }
        ${className}
      `}
    >
      {children}
    </Pressable>
  );
}