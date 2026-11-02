
import { useEffect, useState } from 'react';

import {
  SupplierItemRepository,
} from '@/repositories/item/supplier-item';

import type {
  AvailableSupplyItem,
  SupplyCatalogState,
} from './types';

const CATALOG_PAGE_SIZE = 100;

const supplierItemRepository =
  new SupplierItemRepository();

/**
 * Load all products configured for a supplier.
 *
 * Uses paginated local SQLite reads.
 *
 * Unlike Udhaar, Supply does not use the
 * shop-wide catalog or quick-item suggestions.
 */
async function loadSupplierProducts(
  shopId: string,
  supplierId: string,
  isCancelled: () => boolean
): Promise<AvailableSupplyItem[]> {
  const results: AvailableSupplyItem[] = [];
  const seen = new Set<string>();

  let offset = 0;

  while (!isCancelled()) {
    const page =
      await supplierItemRepository.listBySupplier(
        shopId,
        supplierId,
        CATALOG_PAGE_SIZE,
        offset
      );

    if (isCancelled()) {
      return [];
    }

    for (const item of page) {
      /*
       * Supplier association ID is used for
       * deduplication, not the global item ID.
       */
      if (!seen.has(item.id)) {
        seen.add(item.id);
        results.push(item);
      }
    }

    if (page.length < CATALOG_PAGE_SIZE) {
      break;
    }

    /*
     * Advance by raw page length rather than
     * deduplicated result length.
     */
    offset += page.length;
  }

  return results;
}

/**
 * Load supplier-associated products.
 *
 * - Requires a verified shop identity.
 * - Requires a selected supplier.
 * - Reads only locally configured products.
 * - Prevents stale asynchronous state updates.
 * - Does not modify supplier configuration.
 */
export function useSupplyCatalog({
  shopId,
  supplierId,
}: {
  shopId: string | null;
  supplierId?: string;
}): SupplyCatalogState {
  const [availableItems, setAvailableItems] =
    useState<AvailableSupplyItem[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setAvailableItems([]);
    setError(null);

    const normalizedShopId = shopId?.trim();
    const normalizedSupplierId =
      supplierId?.trim();

    if (
      !normalizedShopId ||
      !normalizedSupplierId
    ) {
      setLoading(false);

      return () => {
        cancelled = true;
      };
    }

    setLoading(true);

    async function loadCatalog(): Promise<void> {
      try {
        const products =
          await loadSupplierProducts(
            normalizedShopId!,
            normalizedSupplierId!,
            () => cancelled
          );

        if (cancelled) {
          return;
        }

        setAvailableItems(products);
      } catch (cause) {
        if (cancelled) {
          return;
        }

        console.warn(
          '[add-supply] Catalog loading failed:',
          cause
        );

        setAvailableItems([]);

        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load supplier products'
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
  }, [shopId, supplierId]);

  return {
    availableItems,
    loading,
    error,
  };
}
