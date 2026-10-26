
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { PartyRepository } from '@/repositories/party/party';

import {
  LedgerHistoryRepository,
  type LedgerHistoryCursor,
  type LedgerHistoryFilter,
} from '@/repositories/ledger/ledger-history';

export type PartyType = 'CUSTOMER' | 'SUPPLIER';

export type TransactionDateFilter =
  | 'recent'
  | 'today'
  | 'yesterday'
  | 'custom';

export interface TransactionFilterState {
  type: TransactionDateFilter;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 30;

const partyRepository = new PartyRepository();
const historyRepository = new LedgerHistoryRepository();

type HistoryPage = Awaited<
  ReturnType<LedgerHistoryRepository['getHistoryPage']>
>;

export type PartyTransactionEntry =
  HistoryPage['entries'][number];

type HistoryPhase = 'initial' | 'older';

function startOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseLocalDate(value: string): Date {
  const parts = value.split('-');

  if (parts.length !== 3) {
    throw new Error('Invalid date');
  }

  const [year, month, day] = parts.map(Number);

  const date = new Date(year, month - 1, day);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error('Invalid date');
  }

  return date;
}

function resolveFilter(
  filter: TransactionFilterState
): LedgerHistoryFilter {
  const today = startOfDay(new Date());

  if (filter.type === 'today') {
    return {
      from: today.toISOString(),
      to: addDays(today, 1).toISOString(),
    };
  }

  if (filter.type === 'yesterday') {
    return {
      from: addDays(today, -1).toISOString(),
      to: today.toISOString(),
    };
  }

  if (filter.type === 'custom') {
    if (!filter.from || !filter.to) {
      throw new Error('Select both dates');
    }

    const from = parseLocalDate(filter.from);
    const to = parseLocalDate(filter.to);

    if (from > to) {
      throw new Error(
        'Start date cannot be after end date'
      );
    }

    return {
      from: from.toISOString(),
      to: addDays(to, 1).toISOString(),
    };
  }

  // Recent: today and the previous two calendar days.
  return {
    from: addDays(today, -2).toISOString(),
    to: addDays(today, 1).toISOString(),
  };
}

export function usePartyTransactions(
  shopId: string | undefined,
  partyId: string | undefined,
  partyType: PartyType
) {
  const [entries, setEntries] =
    useState<PartyTransactionEntry[]>([]);

  const [filter, setFilterState] =
    useState<TransactionFilterState>({
      type: 'recent',
    });

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const cursorRef =
    useRef<LedgerHistoryCursor | null>(null);

  const phaseRef = useRef<HistoryPhase>('initial');

  const initialFromRef =
    useRef<string | null>(null);

  const busyRef = useRef(false);
  const generationRef = useRef(0);

  const [refreshKey, setRefreshKey] = useState(0);

  const setFilter = useCallback(
    (next: TransactionFilterState) => {
      setFilterState(next);
    },
    []
  );

  useEffect(() => {
    const generation = ++generationRef.current;

    cursorRef.current = null;
    phaseRef.current = 'initial';
    initialFromRef.current = null;
    busyRef.current = false;

    setEntries([]);
    setLoading(true);
    setLoadingMore(false);
    setHasMore(false);
    setError(null);

    if (!shopId || !partyId) {
      setLoading(false);

      return () => {
        generationRef.current += 1;
      };
    }

    async function loadInitial(): Promise<void> {
      busyRef.current = true;

      try {
        const party =
          await partyRepository.getByIdAndShop(
            partyId!,
            shopId!
          );

        if (!party || party.type !== partyType) {
          throw new Error(
            partyType === 'CUSTOMER'
              ? 'Customer not found'
              : 'Supplier not found'
          );
        }

        const dateFilter = resolveFilter(filter);

        const page = await historyRepository.getHistoryPage(
          shopId!,
          partyId!,
          {
            limit: PAGE_SIZE,
            filter: dateFilter,
          }
        );

        if (generation !== generationRef.current) {
          return;
        }

        initialFromRef.current =
          dateFilter.from ?? null;

        setEntries(page.entries);
        cursorRef.current = page.nextCursor;

        // Recent mode can continue into older dates.
        setHasMore(
          page.hasMore ||
          filter.type === 'recent'
        );
      } catch (cause) {
        if (generation !== generationRef.current) {
          return;
        }

        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load transactions'
        );
      } finally {
        if (generation === generationRef.current) {
          busyRef.current = false;
          setLoading(false);
        }
      }
    }

    void loadInitial();

    return () => {
      generationRef.current += 1;
    };
  }, [
    shopId,
    partyId,
    partyType,
    filter,
    refreshKey,
  ]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (
      !shopId ||
      !partyId ||
      busyRef.current ||
      loading ||
      !hasMore
    ) {
      return;
    }

    busyRef.current = true;
    setLoadingMore(true);
    setError(null);

    const generation = generationRef.current;

    try {
      const dateFilter = resolveFilter(filter);

      let cursor = cursorRef.current;
      let queryFilter: LedgerHistoryFilter =
        dateFilter;

      /*
       * Recent mode has two phases:
       *
       * 1. Entries within the recent date window.
       * 2. Entries older than that window.
       */
      if (filter.type === 'recent') {
        if (phaseRef.current === 'older') {
          queryFilter = {
            to: initialFromRef.current ?? undefined,
          };
        } else if (!cursor) {
          // All recent entries have been loaded.
          // Begin querying older transactions.
          phaseRef.current = 'older';

          queryFilter = {
            to: initialFromRef.current ?? undefined,
          };

          cursor = null;
        }
      }

      const page = await historyRepository.getHistoryPage(
        shopId,
        partyId,
        {
          limit: PAGE_SIZE,
          cursor,
          filter: queryFilter,
        }
      );

      if (generation !== generationRef.current) {
        return;
      }

      setEntries((previous) => {
        const existing = new Set(
          previous.map((entry) => entry.id)
        );

        return [
          ...previous,
          ...page.entries.filter(
            (entry) => !existing.has(entry.id)
          ),
        ];
      });

      cursorRef.current = page.nextCursor;

      if (
        filter.type === 'recent' &&
        phaseRef.current === 'initial' &&
        !page.hasMore
      ) {
        // Recent entries are exhausted.
        // Allow one more request for older dates.
        phaseRef.current = 'older';
        cursorRef.current = null;
        setHasMore(true);
      } else {
        setHasMore(page.hasMore);
      }
    } catch (cause) {
      if (generation === generationRef.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load older transactions'
        );
      }
    } finally {
      if (generation === generationRef.current) {
        busyRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [
    shopId,
    partyId,
    filter,
    loading,
    hasMore,
  ]);

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  return {
    entries,
    filter,
    setFilter,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
  };
}
