import { useCallback, useEffect, useState } from 'react';

import {
  SupplierItemRepository,
} from '@/repositories/item/supplier-item';

import type { SupplierItem } from '@/types/domain';

const repository = new SupplierItemRepository();

export interface UseSupplierItemOptions {
  shopId: string;
  supplierItemId: string;
}

export function useSupplierItem({
  shopId,
  supplierItemId,
}: UseSupplierItemOptions) {
  const [item, setItem] = useState<SupplierItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!shopId.trim() || !supplierItemId.trim()) {
        setItem(null);
        setError('Shop ID and supplier item ID are required');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await repository.getByIdAndShop(
          supplierItemId,
          shopId
        );

        if (cancelled) return;

        setItem(result);

        if (!result) {
          setError('Supplier product not found');
        }
      } catch (caught) {
        if (cancelled) return;

        setItem(null);
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to load supplier product'
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [shopId, supplierItemId, refreshKey]);

  return {
    item,
    loading,
    error,
    refresh,
  };
}