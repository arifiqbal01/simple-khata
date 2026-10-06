// components/ui/SectionLabel.tsx

import React from 'react';

import {
  AppText,
  type AppTextProps,
} from './AppText';

export function SectionLabel({
  className = '',
  ...props
}: AppTextProps) {
  return (
    <AppText
      {...props}
      className={`
        font-spline-semibold
        text-[13px]
        uppercase
        leading-[18px]
        text-muted
        ${className}
      `}
    />
  );
}