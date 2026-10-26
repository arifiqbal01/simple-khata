
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { ShopRepository } from '@/repositories/bootstrap/shop';
import { DeviceRepository } from '@/repositories/bootstrap/device';
import { LocalIdentityRepository } from '@/repositories/bootstrap/local-identity';

import type {
  Shop,
  Device,
} from '@/types/domain';

const shopRepository = new ShopRepository();
const deviceRepository = new DeviceRepository();
const localIdentityRepository =
  new LocalIdentityRepository();

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
  const [shop, setShop] =
    useState<Shop | null>(null);

  const [device, setDevice] =
    useState<Device | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const reload = useCallback(
    async (): Promise<void> => {
      const requestId = ++requestIdRef.current;

      try {
        if (mountedRef.current) {
          setError(null);
        }

        const identity =
          await localIdentityRepository.get();

        if (!identity) {
          if (
            mountedRef.current &&
            requestId === requestIdRef.current
          ) {
            setShop(null);
            setDevice(null);
          }

          return;
        }

        const [currentShop, currentDevice] =
          await Promise.all([
            shopRepository.getById(identity.shopId),
            deviceRepository.getById(identity.deviceId),
          ]);

        if (
          !mountedRef.current ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        setShop(currentShop);
        setDevice(currentDevice);
      } catch (cause) {
        if (
          !mountedRef.current ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        console.error(
          '[shop-identity] Load failed:',
          cause
        );

        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load shop identity.'
        );
      } finally {
        if (
          mountedRef.current &&
          requestId === requestIdRef.current
        ) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    mountedRef.current = true;

    void reload();

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
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
