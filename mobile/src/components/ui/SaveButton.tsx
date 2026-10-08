
import { memo } from 'react';

import {
  Button,
  type ButtonProps,
} from './Button';

export interface SaveButtonProps
  extends Omit<
    ButtonProps,
    'label' | 'variant' | 'loading'
  > {
  label?: string;
  loading?: boolean;
}

export const SaveButton = memo(
  function SaveButton({
    label = 'Save',
    loading = false,
    disabled = false,
    className = '',
    ...props
  }: SaveButtonProps) {
    return (
      <Button
        {...props}
        label={label}
        variant="primary"
        loading={loading}
        disabled={disabled || loading}
        className={`
          min-h-10
          rounded-control
          bg-black
          px-5
          ${className}
        `}
      />
    );
  }
);
