import React from 'react';
import {
  View,
  type ViewProps,
} from 'react-native';
import {
  SafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';

export interface ScreenProps extends ViewProps {
  children: React.ReactNode;
  padded?: boolean;
  edges?: Edge[];
  className?: string;
}

export function Screen({
  children,
  padded = true,
  edges = ['top'],
  className = '',
  ...props
}: ScreenProps) {
  return (
    <SafeAreaView
      edges={edges}
      className="flex-1 bg-background"
    >
      <View
        {...props}
        className={`
          flex-1
          ${padded ? 'px-5' : ''}
          ${className}
        `}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}