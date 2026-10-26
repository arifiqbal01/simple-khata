
import { useEffect, useState } from 'react';

import type { Item } from '@/types/domain';

import { ItemRepository } from '@/repositories/item/item';
import { QuickItemsRepository } from '@/repositories/item/quick-items';

import { SearchItemsService } from '@/services/item/search';
import {
  GetQuickItemsService,
  type QuickItem,
} from '@/services/item/get-quick-items';

import {
  QUICK_ITEMS_VISIBLE_LIMIT,
} from '@/config/quick-items';

import { getStarterQuickItems } from './utils';
import type { UdhaarCatalogState } from './types';

const searchItemsService = new SearchItemsService(
  new ItemRepository()
);

const quickItemsService = new GetQuickItemsService(
  new QuickItemsRepository()
);

export function useUdhaarCatalog({
  shopId,
  customerId,
}: {
  shopId: string | null;
  customerId?: string;
}): UdhaarCatalogState {
  const [availableItems, setAvailableItems] =
    useState<Item[]>([]);

  const [quickItems, setQuickItems] =
    useState<QuickItem[]>(
      getStarterQuickItems([])
    );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    setAvailableItems([]);
    setQuickItems(getStarterQuickItems([]));
    setError(null);
    setLoading(true);

    if (!shopId || !customerId) {
      return () => {
        cancelled = true;
      };
    }

    async function loadCatalog() {
      try {
        const currentItems =
          await searchItemsService.execute({
            shopId: shopId!,
            query: '',
            limit: 100,
          });

        if (cancelled) return;

        setAvailableItems(currentItems);
        setQuickItems(
          getStarterQuickItems(currentItems)
        );

        try {
          const suggestions =
            await quickItemsService.execute({
              shopId: shopId!,
              customerId: customerId!,
              availableItems: currentItems,
            });

          if (cancelled) return;

          if (suggestions.length > 0) {
            setQuickItems(
              suggestions.slice(
                0,
                QUICK_ITEMS_VISIBLE_LIMIT
              )
            );
          }
        } catch (suggestionError) {
          console.warn(
            '[add-udhaar] Quick items unavailable:',
            suggestionError
          );
        }
      } catch (cause) {
        if (cancelled) return;

        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load items'
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [shopId, customerId]);

  return {
    availableItems,
    quickItems,
    loading,
    error,
  };
}
