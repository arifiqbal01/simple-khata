
import { useCallback, useEffect, useState } from 'react';

import { getDatabase } from '@/db/database';
import { ShopRepository } from '@/repositories/shop';
import { DeviceRepository } from '@/repositories/device';

import type { Shop, Device } from '@/types/domain';

const shopRepository = new ShopRepository();
const deviceRepository = new DeviceRepository();

interface LocalIdentityRow {
  shop_id: string;
  device_id: string;
}

export interface ShopIdentity {
  shop: Shop | null;
  device: Device | null;
  shopId: string | null;
  deviceId: string | null;
  shopName: string;
  deviceName: string;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useShopIdentity(): ShopIdentity {
  const [shop, setShop] = useState<Shop | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);

      const db = await getDatabase();

      const identity =
        await db.getFirstAsync<LocalIdentityRow>(
          `
            SELECT shop_id, device_id
            FROM local_identity
            LIMIT 1
          `
        );

      if (!identity) {
        setShop(null);
        setDevice(null);
        return;
      }

      const [currentShop, currentDevice] =
        await Promise.all([
          shopRepository.getById(identity.shop_id),
          deviceRepository.getById(identity.device_id),
        ]);

      setShop(currentShop);
      setDevice(currentDevice);
    } catch (cause) {
      console.error(
        '[shop-identity] load failed',
        cause
      );

      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not load shop identity.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    shop,
    device,
    shopId: shop?.id ?? null,
    deviceId: device?.id ?? null,
    shopName: shop?.name ?? '',
    deviceName: device?.name ?? '',
    loading,
    error,
    reload,
  };
}
