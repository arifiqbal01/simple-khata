
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

type PartyBalanceResult = Awaited<
  ReturnType<PartyRepository['getBalanceSummary']>
>;

type BalanceParty =
  PartyBalanceResult['parties'][number];

export type PartyWithBalance = BalanceParty & {
  type: PartyType;
};

const partyRepository = new PartyRepository();
const shopRepository = new ShopRepository();

export function usePartyList(partyType: PartyType) {
  const [shopId, setShopId] =
    useState<string | null>(null);

  const [parties, setParties] =
    useState<PartyWithBalance[]>([]);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const requestIdRef = useRef(0);
  const queryRef = useRef('');

  const loadParties = useCallback(
    async (
      currentShopId: string,
      searchQuery: string
    ): Promise<void> => {
      const requestId = ++requestIdRef.current;

      const result =
        await partyRepository.getBalanceSummary(
          currentShopId,
          partyType,
          searchQuery
        );

      if (
        requestId !== requestIdRef.current
      ) {
        return;
      }

      setParties(
        result.parties.map((party) => ({
          ...party,
          type: partyType,
        }))
      );

      setError(null);
    },
    [partyType]
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      setError(null);
      setParties([]);
      setShopId(null);

      try {
        const shop =
          await shopRepository.getFirst();

        if (!shop) {
          throw new Error(
            'Shop has not been initialized'
          );
        }

        if (cancelled) {
          return;
        }

        setShopId(shop.id);

        await loadParties(
          shop.id,
          queryRef.current
        );
      } catch (cause) {
        if (cancelled) {
          return;
        }

        const message =
          cause instanceof Error
            ? cause.message
            : 'Could not load parties';

        console.error(
          '[usePartyList] Initialization failed:',
          cause
        );

        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      requestIdRef.current += 1;
    };
  }, [loadParties]);

  useFocusEffect(
    useCallback(() => {
      if (!shopId || loading) {
        return;
      }

      void loadParties(
        shopId,
        queryRef.current
      ).catch((cause) => {
        console.error(
          '[usePartyList] Focus refresh failed:',
          cause
        );

        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not refresh parties'
        );
      });
    }, [shopId, loading, loadParties])
  );

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      queryRef.current = value;

      if (!shopId) {
        return;
      }

      void loadParties(shopId, value).catch(
        (cause) => {
          console.error(
            '[usePartyList] Search failed:',
            cause
          );

          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not search parties'
          );
        }
      );
    },
    [shopId, loadParties]
  );

  const refresh = useCallback(async () => {
    if (!shopId || refreshing) {
      return;
    }

    setRefreshing(true);

    try {
      await loadParties(
        shopId,
        queryRef.current
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not refresh parties'
      );
    } finally {
      setRefreshing(false);
    }
  }, [shopId, refreshing, loadParties]);

  return {
    shopId,
    parties,
    query,
    loading,
    refreshing,
    error,
    handleSearch,
    refresh,
  };
}
