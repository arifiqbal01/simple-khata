
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import { router } from 'expo-router';

import { DeviceRepository } from '@/repositories/bootstrap/device';
import { LocalIdentityRepository } from '@/repositories/bootstrap/local-identity';
import { ShopRepository } from '@/repositories/bootstrap/shop';

import { BootstrapDeviceService } from '@/services/bootstrap/device';

export type BootstrapMode = 'create' | 'join';

const bootstrapService = new BootstrapDeviceService(
  new ShopRepository(),
  new DeviceRepository(),
  new LocalIdentityRepository()
);

export function useBootstrap() {
  const [mode, setMode] =
    useState<BootstrapMode>('create');

  const [shopId, setShopId] = useState('');
  const [shopName, setShopName] = useState('');
  const [deviceName, setDeviceName] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const savingRef = useRef(false);

  const canContinue = useMemo(() => {
    const validShopName =
      shopName.trim().length > 0;

    const validDeviceName =
      deviceName.trim().length > 0;

    const validShopId =
      mode === 'create' ||
      shopId.trim().length > 0;

    return (
      validShopName &&
      validDeviceName &&
      validShopId &&
      !isSaving
    );
  }, [
    mode,
    shopId,
    shopName,
    deviceName,
    isSaving,
  ]);

  const changeMode = useCallback(
    (nextMode: BootstrapMode) => {
      if (savingRef.current) {
        return;
      }

      setMode(nextMode);
      setError(null);
    },
    []
  );

  const handleContinue = useCallback(async () => {
    if (
      !canContinue ||
      savingRef.current
    ) {
      return;
    }

    const normalizedShopId =
      shopId.trim();

    const normalizedShopName =
      shopName.trim();

    const normalizedDeviceName =
      deviceName.trim();

    if (!normalizedShopName) {
      setError('Enter a shop name.');
      return;
    }

    if (!normalizedDeviceName) {
      setError('Enter a device name.');
      return;
    }

    if (
      mode === 'join' &&
      !normalizedShopId
    ) {
      setError('Enter the shop ID to join.');
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);

    try {
      const identity =
        mode === 'create'
          ? await bootstrapService.createShop({
              shopName: normalizedShopName,
              deviceName: normalizedDeviceName,
            })
          : await bootstrapService.joinShop({
              shopId: normalizedShopId,
              shopName: normalizedShopName,
              deviceName: normalizedDeviceName,
            });

      console.log('[bootstrap] complete', {
        mode,
        shopId: identity.shop.id,
        deviceId: identity.device.id,
      });

      // Bootstrap is complete. Enter the main app.
      router.replace('/');
    } catch (cause) {
      console.error(
        '[bootstrap] setup failed:',
        cause
      );

      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not set up this device.'
      );
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [
    canContinue,
    mode,
    shopId,
    shopName,
    deviceName,
  ]);

  return {
    mode,
    changeMode,

    shopId,
    setShopId,

    shopName,
    setShopName,

    deviceName,
    setDeviceName,

    isSaving,
    error,
    canContinue,
    handleContinue,
  };
}
