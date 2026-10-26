import { useCallback, useEffect, useState } from 'react';

import {
  SupplierItemRepository,
  type SupplierItemWithDetails,
} from '@/repositories/item/supplier-item';

const PAGE_SIZE = 50;
const repository = new SupplierItemRepository();

export interface UseSupplierItemsOptions {
  shopId: string;
  supplierId: string;
}

export function useSupplierItems({
  shopId,
  supplierId,
}: UseSupplierItemsOptions) {
  const [items, setItems] = useState<SupplierItemWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!shopId.trim() || !supplierId.trim()) {
        setItems([]);
        setHasMore(false);
        setLoading(false);
        setError('Shop ID and supplier ID are required');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await repository.listBySupplier(
          shopId,
          supplierId,
          PAGE_SIZE,
          0
        );

        if (cancelled) return;

        setItems(results);
        setHasMore(results.length === PAGE_SIZE);
      } catch (caught) {
        if (cancelled) return;

        setItems([]);
        setHasMore(false);
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to load supplier products'
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
  }, [shopId, supplierId, refreshKey]);

  const loadMore = useCallback(async () => {
    if (
      loading ||
      loadingMore ||
      !hasMore ||
      !shopId.trim() ||
      !supplierId.trim()
    ) {
      return;
    }

    setLoadingMore(true);

    try {
      const next = await repository.listBySupplier(
        shopId,
        supplierId,
        PAGE_SIZE,
        items.length
      );

      setItems((current) => {
        const existingIds = new Set(
          current.map((item) => item.id)
        );

        return [
          ...current,
          ...next.filter((item) => !existingIds.has(item.id)),
        ];
      });

      setHasMore(next.length === PAGE_SIZE);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load more supplier products'
      );
    } finally {
      setLoadingMore(false);
    }
  }, [
    shopId,
    supplierId,
    items.length,
    loading,
    loadingMore,
    hasMore,
  ]);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
  };
}