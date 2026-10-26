
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { ItemRepository } from '@/repositories/item/item';
import type { Item } from '@/types/domain';

const itemRepository = new ItemRepository();

export interface UseItemOptions {
  shopId: string;
  itemId: string;
}

export function useItem({
  shopId,
  itemId,
}: UseItemOptions) {
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    null
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadItem() {
      if (!shopId.trim() || !itemId.trim()) {
        setItem(null);
        setError('Shop ID and Item ID are required');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await itemRepository.getByIdAndShop(
            itemId,
            shopId
          );

        if (cancelled) return;

        setItem(result);

        if (!result) {
          setError('Item not found');
        }
      } catch (caught) {
        if (cancelled) return;

        setItem(null);
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to load item'
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadItem();

    return () => {
      cancelled = true;
    };
  }, [shopId, itemId, refreshKey]);

  return {
    item,
    loading,
    error,
    refresh,
  };
}
