
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { CustomerRepository } from '@/repositories/customer';

import {
  LedgerRepository,
  type LedgerHistoryCursor,
  type LedgerHistoryFilter,
  type LedgerHistoryWithBalance,
} from '@/repositories/ledger';

import { GetLedgerHistoryService } from '@/services/ledger/get-history';

export type TransactionDateFilter =
  | 'recent'
  | 'today'
  | 'yesterday'
  | 'custom';

export interface TransactionFilterState {
  type: TransactionDateFilter;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD, inclusive
}

const PAGE_SIZE = 30;

const service = new GetLedgerHistoryService(
  new LedgerRepository(),
  new CustomerRepository()
);

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
  const [year, month, day] = value
    .split('-')
    .map(Number);

  const date = new Date(year, month - 1, day);

  if (
    !year ||
    !month ||
    !day ||
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

  // Today + previous two calendar days
  return {
    from: addDays(today, -2).toISOString(),
    to: addDays(today, 1).toISOString(),
  };
}

function olderThan(
  timestamp: string
): LedgerHistoryCursor {
  return {
    occurredAt: timestamp,
    createdAt: '',
    id: '',
  };
}

export function useCustomerTransactions(
  shopId: string | undefined,
  customerId: string | undefined
) {
  const [entries, setEntries] = useState<
    LedgerHistoryWithBalance[]
  >([]);

  const [filter, setFilterState] =
    useState<TransactionFilterState>({
      type: 'recent',
    });

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] =
    useState(false);

  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<
    string | null
  >(null);

  const cursorRef =
    useRef<LedgerHistoryCursor | null>(null);

  const phaseRef = useRef<'initial' | 'older'>(
    'initial'
  );

  const initialFromRef = useRef<string | null>(
    null
  );

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

    if (!shopId || !customerId) {
      setLoading(false);
      return;
    }

    async function loadInitial() {
      busyRef.current = true;

      try {
        const dateFilter = resolveFilter(filter);

        initialFromRef.current =
          dateFilter.from ?? null;

        const page = await service.executePage({
          shopId: shopId!,
          customerId: customerId!,
          limit: PAGE_SIZE,
          filter: dateFilter,
        });

        if (generation !== generationRef.current) {
          return;
        }

        setEntries(page.entries);
        cursorRef.current = page.nextCursor;

        // Recent mode also allows loading dates
        // older than the initial three-day window.
        setHasMore(
          page.hasMore || filter.type === 'recent'
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
      generationRef.current++;
    };
  }, [
    shopId,
    customerId,
    filter,
    refreshKey,
  ]);

  const loadMore = useCallback(async () => {
    if (
      !shopId ||
      !customerId ||
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

      if (
        filter.type === 'recent' &&
        phaseRef.current === 'older'
      ) {
        queryFilter = {
          to: initialFromRef.current ?? undefined,
        };
      }

      if (
        filter.type === 'recent' &&
        phaseRef.current === 'initial' &&
        !cursor
      ) {
        phaseRef.current = 'older';

        queryFilter = {
          to: initialFromRef.current ?? undefined,
        };

        cursor = null;
      }

      const page = await service.executePage({
        shopId,
        customerId,
        limit: PAGE_SIZE,
        cursor,
        filter: queryFilter,
      });

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
    customerId,
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
