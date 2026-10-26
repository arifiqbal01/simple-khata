
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { Item } from '@/types/domain';
import { ItemRepository } from '@/repositories/item/item';

const itemRepository = new ItemRepository();

const PAGE_SIZE = 30;

export interface UseItemsOptions {
  shopId: string;
  query?: string;
}

export function useItems({
  shopId,
  query = '',
}: UseItemsOptions) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const hasMoreRef = useRef(false);
  const busyRef = useRef(false);
  const generationRef = useRef(0);

  const normalizedQuery = query.trim();

  const fetchPage = useCallback(
    async (
      offset: number,
      generation: number
    ): Promise<Item[]> => {
      if (!shopId.trim()) {
        return [];
      }

      if (normalizedQuery) {
        return itemRepository.search(
          shopId,
          normalizedQuery,
          PAGE_SIZE,
          offset
        );
      }

      return itemRepository.listByShop(
        shopId,
        PAGE_SIZE,
        offset
      );
    },
    [shopId, normalizedQuery]
  );

  const loadFirstPage = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const generation = ++generationRef.current;

      busyRef.current = true;
      offsetRef.current = 0;
      hasMoreRef.current = false;

      setError(null);
      setHasMore(false);
      setLoadingMore(false);

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
        setItems([]);
      }

      try {
        const page = await fetchPage(
          0,
          generation
        );

        if (generation !== generationRef.current) {
          return;
        }

        setItems(page);
        offsetRef.current = page.length;

        const more = page.length === PAGE_SIZE;

        hasMoreRef.current = more;
        setHasMore(more);
      } catch (cause) {
        if (generation !== generationRef.current) {
          return;
        }

        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to load items'
        );
      } finally {
        if (generation === generationRef.current) {
          busyRef.current = false;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetchPage]
  );

  useEffect(() => {
    void loadFirstPage('initial');

    return () => {
      generationRef.current += 1;
    };
  }, [loadFirstPage]);

  const refresh = useCallback(async () => {
    await loadFirstPage('refresh');
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (
      !shopId.trim() ||
      busyRef.current ||
      !hasMoreRef.current
    ) {
      return;
    }

    busyRef.current = true;
    setLoadingMore(true);
    setError(null);

    const generation = generationRef.current;
    const offset = offsetRef.current;

    try {
      const page = await fetchPage(
        offset,
        generation
      );

      if (generation !== generationRef.current) {
        return;
      }

      setItems((current) => {
        const existingIds = new Set(
          current.map((item) => item.id)
        );

        return [
          ...current,
          ...page.filter(
            (item) => !existingIds.has(item.id)
          ),
        ];
      });

      offsetRef.current += page.length;

      const more = page.length === PAGE_SIZE;

      hasMoreRef.current = more;
      setHasMore(more);
    } catch (cause) {
      if (generation !== generationRef.current) {
        return;
      }

      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to load more items'
      );
    } finally {
      if (generation === generationRef.current) {
        busyRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [shopId, fetchPage]);

  return {
    items,
    loading,
    loadingMore,
    refreshing,
    hasMore,
    error,
    refresh,
    loadMore,
  };
}
