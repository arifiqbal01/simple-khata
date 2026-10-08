
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const iconName = destructive
    ? 'trash-outline'
    : 'help-circle-outline';

  const accentColor = destructive
    ? '#DC2626'
    : '#242422';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!loading) onCancel();
      }}
    >
      <View className="flex-1 items-center justify-center bg-black/40 px-5">
        <Pressable
          className="absolute inset-0"
          onPress={() => {
            if (!loading) onCancel();
          }}
          accessibilityLabel="Dismiss confirmation"
        />

        <View
          className="w-full max-w-[400px] rounded-[24px] border border-border bg-white p-6"
          accessibilityViewIsModal
        >
          <View
            className={`mb-4 h-12 w-12 items-center justify-center rounded-2xl ${
              destructive ? 'bg-red-50' : 'bg-[#F1F1EF]'
            }`}
          >
            <Ionicons
              name={iconName}
              size={24}
              color={accentColor}
            />
          </View>

          <AppText className="text-[20px] font-semibold text-[#181816]">
            {title}
          </AppText>

          {message ? (
            <AppText className="mt-2 text-[14px] leading-6 text-[#73736D]">
              {message}
            </AppText>
          ) : null}

          <View className="mt-6 flex-row gap-3">
            <Pressable
              onPress={onCancel}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={cancelText}
              className={`h-12 flex-1 items-center justify-center rounded-xl border border-[#E7E7E2] bg-white ${
                loading ? 'opacity-50' : ''
              }`}
            >
              <AppText className="font-medium text-[#242422]">
                {cancelText}
              </AppText>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
              className={`h-12 flex-1 flex-row items-center justify-center rounded-xl ${
                destructive ? 'bg-[#DC2626]' : 'bg-[#242422]'
              } ${loading ? 'opacity-70' : ''}`}
            >
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <AppText className="font-semibold text-white">
                  {confirmText}
                </AppText>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default ConfirmModal;
