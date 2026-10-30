
import {
  useCallback,
  useState,
} from 'react';

import { useFocusEffect } from 'expo-router';

import {
  PartyRepository,
  type PartyFinancialTotals,
} from '@/repositories/party/party';

import { ShopRepository } from '@/repositories/bootstrap/shop';
import type { PartyType } from '@/types/domain';

const partyRepository = new PartyRepository();
const shopRepository = new ShopRepository();

export function usePartyFinancialTotals(
  partyType: PartyType
) {
  const [totals, setTotals] =
    useState<PartyFinancialTotals | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        setError(null);

        try {
          const shop = await shopRepository.getFirst();

          if (!shop) {
            throw new Error(
              'Shop has not been initialized'
            );
          }

          const result =
            await partyRepository.getFinancialTotals(
              shop.id,
              partyType
            );

          if (active) {
            setTotals(result);
          }
        } catch (cause) {
          if (active) {
            setTotals(null);
            setError(
              cause instanceof Error
                ? cause.message
                : 'Could not load financial totals'
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void load();

      return () => {
        active = false;
      };
    }, [partyType, refreshKey])
  );

  return {
    totals,
    loading,
    error,
    refresh,
  };
}
