
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useFocusEffect } from 'expo-router';

import { PartyRepository } from '@/repositories/party/party';
import { ShopRepository } from '@/repositories/bootstrap/shop';

export type PartyType = 'CUSTOMER' | 'SUPPLIER';

type BalancePage = Awaited<
  ReturnType<PartyRepository['getBalancePage']>
>;

type BalanceParty = BalancePage['parties'][number];

export type PartyWithBalance = BalanceParty & {
  type: PartyType;
};

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 250;

const partyRepository = new PartyRepository();
const shopRepository = new ShopRepository();

function errorMessage(
  cause: unknown,
  fallback: string
): string {
  return cause instanceof Error
    ? cause.message
    : fallback;
}

export function usePartyList(partyType: PartyType) {
  const [shopId, setShopId] = useState<string | null>(
    null
  );

  const [parties, setParties] = useState<
    PartyWithBalance[]
  >([]);

  const [query, setQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const [totalCount, setTotalCount] = useState(0);
  const [totalOutstanding, setTotalOutstanding] =
    useState(0);

  const [error, setError] = useState<string | null>(
    null
  );

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const shopIdRef = useRef<string | null>(null);
  const queryRef = useRef('');

  const offsetRef = useRef(0);
  const hasMoreRef = useRef(false);

  const loadingMoreRef = useRef(false);
  const refreshingRef = useRef(false);
  const firstLoadRef = useRef(true);

  const searchTimerRef = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  const cancelSearch = useCallback(() => {
    if (searchTimerRef.current !== null) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  }, []);

  const applyPage = useCallback(
    (
      result: BalancePage,
      append: boolean
    ) => {
      const mapped: PartyWithBalance[] =
        result.parties.map((party) => ({
          ...party,
          type: partyType,
        }));

      setParties((current) => {
        if (!append) {
          return mapped;
        }

        const existingIds = new Set(
          current.map((party) => party.id)
        );

        return [
          ...current,
          ...mapped.filter(
            (party) => !existingIds.has(party.id)
          ),
        ];
      });

      offsetRef.current =
        result.offset + result.parties.length;

      hasMoreRef.current = result.hasMore;
      setHasMore(result.hasMore);

      setTotalCount(result.totalCount);
      setTotalOutstanding(result.totalOutstanding);
      setError(null);
    },
    [partyType]
  );

  const loadFirstPage = useCallback(
    async (
      currentShopId: string,
      searchQuery: string
    ): Promise<void> => {
      const requestId = ++requestIdRef.current;

      hasMoreRef.current = false;
      setHasMore(false);

      const result =
        await partyRepository.getBalancePage(
          currentShopId,
          partyType,
          {
            query: searchQuery,
            limit: PAGE_SIZE,
            offset: 0,
          }
        );

      if (
        !mountedRef.current ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      applyPage(result, false);
    },
    [partyType, applyPage]
  );

  const loadNextPage = useCallback(
    async (): Promise<void> => {
      const currentShopId = shopIdRef.current;

      if (
        !currentShopId ||
        !hasMoreRef.current ||
        loadingMoreRef.current ||
        refreshingRef.current ||
        searchTimerRef.current !== null
      ) {
        return;
      }

      loadingMoreRef.current = true;
      setLoadingMore(true);

      const requestId = requestIdRef.current;
      const offset = offsetRef.current;

      try {
        const result =
          await partyRepository.getBalancePage(
            currentShopId,
            partyType,
            {
              query: queryRef.current,
              limit: PAGE_SIZE,
              offset,
            }
          );

        if (
          !mountedRef.current ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        applyPage(result, true);
      } catch (cause) {
        if (
          mountedRef.current &&
          requestId === requestIdRef.current
        ) {
          console.error(
            '[usePartyList] Load more failed:',
            cause
          );

          setError(
            errorMessage(
              cause,
              'Could not load more parties'
            )
          );
        }
      } finally {
        loadingMoreRef.current = false;

        if (mountedRef.current) {
          setLoadingMore(false);
        }
      }
    },
    [partyType, applyPage]
  );

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      setError(null);
      setParties([]);

      setShopId(null);
      shopIdRef.current = null;

      offsetRef.current = 0;
      hasMoreRef.current = false;
      setHasMore(false);

      try {
        const shop = await shopRepository.getFirst();

        if (!shop) {
          throw new Error(
            'Shop has not been initialized'
          );
        }

        if (cancelled) {
          return;
        }

        shopIdRef.current = shop.id;
        setShopId(shop.id);

        await loadFirstPage(
          shop.id,
          queryRef.current
        );
      } catch (cause) {
        if (cancelled) {
          return;
        }

        console.error(
          '[usePartyList] Initialization failed:',
          cause
        );

        setError(
          errorMessage(
            cause,
            'Could not load parties'
          )
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      requestIdRef.current += 1;
      cancelSearch();
    };
  }, [loadFirstPage, cancelSearch]);

  useFocusEffect(
    useCallback(() => {
      /*
       * Initialization already loads page one.
       * Skip the first focus event.
       */
      if (firstLoadRef.current) {
        firstLoadRef.current = false;
        return;
      }

      const currentShopId = shopIdRef.current;

      if (!currentShopId) {
        return;
      }

      cancelSearch();

      void loadFirstPage(
        currentShopId,
        queryRef.current
      ).catch((cause) => {
        if (!mountedRef.current) {
          return;
        }

        setError(
          errorMessage(
            cause,
            'Could not refresh parties'
          )
        );
      });
    }, [loadFirstPage, cancelSearch])
  );

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      queryRef.current = value;

      cancelSearch();

      /*
       * Invalidate outstanding page requests as
       * soon as the search text changes.
       */
      requestIdRef.current += 1;
      hasMoreRef.current = false;
      setHasMore(false);

      const currentShopId = shopIdRef.current;

      if (!currentShopId) {
        return;
      }

      searchTimerRef.current = setTimeout(() => {
        searchTimerRef.current = null;

        void loadFirstPage(
          currentShopId,
          value
        ).catch((cause) => {
          if (!mountedRef.current) {
            return;
          }

          setError(
            errorMessage(
              cause,
              'Could not search parties'
            )
          );
        });
      }, SEARCH_DELAY_MS);
    },
    [cancelSearch, loadFirstPage]
  );

  const refresh = useCallback(async () => {
    const currentShopId = shopIdRef.current;

    if (
      !currentShopId ||
      refreshingRef.current
    ) {
      return;
    }

    cancelSearch();

    refreshingRef.current = true;
    setRefreshing(true);

    try {
      await loadFirstPage(
        currentShopId,
        queryRef.current
      );
    } catch (cause) {
      if (mountedRef.current) {
        setError(
          errorMessage(
            cause,
            'Could not refresh parties'
          )
        );
      }
    } finally {
      refreshingRef.current = false;

      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [cancelSearch, loadFirstPage]);

  return {
    shopId,
    parties,
    query,

    loading,
    refreshing,
    loadingMore,
    hasMore,

    totalCount,
    totalOutstanding,
    pageSize: PAGE_SIZE,

    error,

    handleSearch,
    refresh,
    loadMore: loadNextPage,
  };
}
