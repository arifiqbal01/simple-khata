
import { useEffect, useState } from 'react';

import type { Item } from '@/types/domain';

import { ItemRepository } from '@/repositories/item/item';
import { QuickItemsRepository } from '@/repositories/item/quick-items';

import { SearchItemsService } from '@/services/item/search';

import {
  GetQuickItemsService,
  type QuickItem,
} from '@/services/item/get-quick-items';

import { QUICK_ITEMS_VISIBLE_LIMIT } from '@/config/quick-items';

import type { UdhaarCatalogState } from './types';

const CATALOG_PAGE_SIZE = 100;

const searchItemsService = new SearchItemsService(
  new ItemRepository()
);

const quickItemsService = new GetQuickItemsService(
  new QuickItemsRepository()
);

async function loadAllCatalogItems(
  shopId: string
): Promise<Item[]> {
  const items: Item[] = [];
  const seen = new Set<string>();

  let offset = 0;

  while (true) {
    const page = await searchItemsService.execute({
      shopId,
      query: '',
      limit: CATALOG_PAGE_SIZE,
      offset,
    });

    for (const item of page) {
      if (
        item.deleted_at == null &&
        !seen.has(item.id)
      ) {
        seen.add(item.id);
        items.push(item);
      }
    }

    if (page.length < CATALOG_PAGE_SIZE) {
      break;
    }

    offset += page.length;
  }

  return items;
}

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
    useState<QuickItem[]>([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    setAvailableItems([]);
    setQuickItems([]);
    setError(null);

    if (!shopId) {
      setLoading(false);

      return () => {
        cancelled = true;
      };
    }

    setLoading(true);

    async function loadCatalog() {
      try {
        const currentItems =
          await loadAllCatalogItems(shopId!);

        if (cancelled) {
          return;
        }

        setAvailableItems(currentItems);

        /*
         * Quick items are based on real usage,
         * not hardcoded starter suggestions.
         *
         * A customer ID may improve ranking,
         * but catalog loading should not require it.
         */
        try {
          const suggestions =
            await quickItemsService.execute({
              shopId: shopId!,
              customerId,
              availableItems: currentItems,
            });

          if (cancelled) {
            return;
          }

          const validIds = new Set(
            currentItems.map((item) => item.id)
          );

          const filteredSuggestions =
            suggestions.filter(
              (item) =>
                item.id !== null &&
                validIds.has(item.id)
            );

          setQuickItems(
            filteredSuggestions.slice(
              0,
              QUICK_ITEMS_VISIBLE_LIMIT
            )
          );
        } catch (suggestionError) {
          if (cancelled) {
            return;
          }

          console.warn(
            '[add-udhaar] Quick items unavailable:',
            suggestionError
          );

          setQuickItems([]);
        }
      } catch (cause) {
        if (cancelled) {
          return;
        }

        console.warn(
          '[add-udhaar] Catalog loading failed:',
          cause
        );

        setAvailableItems([]);
        setQuickItems([]);

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
