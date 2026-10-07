// components/ui/SectionLabel.tsx

import React from 'react';

import {
  AppText,
  type AppTextProps,
} from './AppText';

export type SectionLabelProps = AppTextProps;

export function SectionLabel({
  className = '',
  ...props
}: SectionLabelProps) {
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