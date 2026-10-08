
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ToastConfig } from 'react-native-toast-message';

import { AppText } from './AppText';

type ToastVariant = 'success' | 'error' | 'info';

interface CustomToastProps {
  variant: ToastVariant;
  title?: string;
  message?: string;
}

const variants = {
  success: {
    icon: 'checkmark-circle-outline' as const,
    color: '#15803D',
    background: '#F0FDF4',
  },
  error: {
    icon: 'alert-circle-outline' as const,
    color: '#DC2626',
    background: '#FEF2F2',
  },
  info: {
    icon: 'information-circle-outline' as const,
    color: '#2563EB',
    background: '#EFF6FF',
  },
};

function CustomToast({
  variant,
  title,
  message,
}: CustomToastProps) {
  const style = variants[variant];

  return (
    <View
      className="w-[92%] max-w-[440px] flex-row items-start rounded-2xl border border-[#E7E7E2] bg-white px-4 py-3"
      style={{
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: {
          width: 0,
          height: 4,
        },
        elevation: 5,
      }}
    >
      <View
        className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: style.background }}
      >
        <Ionicons
          name={style.icon}
          size={22}
          color={style.color}
        />
      </View>

      <View className="flex-1 justify-center py-0.5">
        {title ? (
          <AppText className="text-[14px] font-semibold text-[#181816]">
            {title}
          </AppText>
        ) : null}

        {message ? (
          <AppText className="mt-1 text-[12px] leading-5 text-[#73736D]">
            {message}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => (
    <CustomToast
      variant="success"
      title={text1}
      message={text2}
    />
  ),

  error: ({ text1, text2 }) => (
    <CustomToast
      variant="error"
      title={text1}
      message={text2}
    />
  ),

  info: ({ text1, text2 }) => (
    <CustomToast
      variant="info"
      title={text1}
      message={text2}
    />
  ),
};
