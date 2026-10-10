
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Crypto from 'expo-crypto';

import { CustomerRepository } from '@/repositories/customer';
import { ItemRepository } from '@/repositories/item';
import { LedgerRepository } from '@/repositories/ledger';
import { LocalIdentityRepository } from '@/repositories/local-identity';
import { QuickItemsRepository } from '@/repositories/quick-items';
import { syncOutboxRepository } from '@/repositories/sync-outbox';

import { CreateItemService } from '@/services/item/create';
import { SearchItemsService } from '@/services/item/search';
import {
  GetQuickItemsService,
  type QuickItem,
} from '@/services/item/get-quick-items';
import { GetCustomerBalanceService } from '@/services/ledger/get-balance';
import {
  CreateUdhaarService,
  type CreateUdhaarItemInput,
} from '@/services/ledger/create-udhaar';

import type { Customer, Item } from '@/types/domain';
import {
  DEFAULT_QUICK_ITEMS,
  QUICK_ITEMS_VISIBLE_LIMIT,
} from '@/config/quick-items';

const customerRepository = new CustomerRepository();
const itemRepository = new ItemRepository();
const ledgerRepository = new LedgerRepository();
const identityRepository = new LocalIdentityRepository();

const createItemService = new CreateItemService(
  itemRepository,
  syncOutboxRepository
);

const searchItemsService = new SearchItemsService(
  itemRepository
);

const quickItemsService = new GetQuickItemsService(
  new QuickItemsRepository()
);

const balanceService = new GetCustomerBalanceService(
  ledgerRepository,
  customerRepository
);

const createUdhaarService = new CreateUdhaarService(
  ledgerRepository,
  customerRepository,
  syncOutboxRepository
);

export interface DraftUdhaarItem {
  id: string;
  itemId: string | null;
  name: string;
  source: 'selected' | 'editor';
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function emptyItem(): DraftUdhaarItem {
  return {
    id: Crypto.randomUUID(),
    itemId: null,
    name: '',
    source: 'editor',
  };
}

function getStarterQuickItems(
  catalog: Item[]
): QuickItem[] {
  return DEFAULT_QUICK_ITEMS
    .slice(0, QUICK_ITEMS_VISIBLE_LIMIT)
    .map((name, index) => {
      const existing = catalog.find(
        (item) =>
          normalizeName(item.name) === normalizeName(name)
      );

      return {
        id: existing?.id ?? null,
        name: existing?.name ?? name,
        score: DEFAULT_QUICK_ITEMS.length - index,
      };
    });
}

export function useAddUdhaar(customerId?: string) {
  const [shopId, setShopId] = useState<string | null>(
    null
  );
  const [deviceId, setDeviceId] = useState<string | null>(
    null
  );
  const [customer, setCustomer] = useState<Customer | null>(
    null
  );
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');

  const [items, setItems] = useState<DraftUdhaarItem[]>(
    []
  );
  const [availableItems, setAvailableItems] = useState<
    Item[]
  >([]);
  const [quickItems, setQuickItems] = useState<QuickItem[]>(
    getStarterQuickItems([])
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      setError(null);
      setQuickItems(getStarterQuickItems([]));

      try {
        if (!customerId) {
          throw new Error('Customer ID is missing');
        }

        const identity = await identityRepository.get();

        if (!identity) {
          throw new Error(
            'Local installation identity not found'
          );
        }

        const currentCustomer =
          await customerRepository.getByIdAndShop(
            customerId,
            identity.shopId
          );

        if (!currentCustomer) {
          throw new Error('Customer not found');
        }

        const [currentBalance, currentItems] =
          await Promise.all([
            balanceService.execute({
              shopId: identity.shopId,
              customerId,
            }),
            searchItemsService.execute({
              shopId: identity.shopId,
              query: '',
              limit: 100,
            }),
          ]);

        if (cancelled) return;

        setShopId(identity.shopId);
        setDeviceId(identity.deviceId);
        setCustomer(currentCustomer);
        setBalance(currentBalance);
        setAvailableItems(currentItems);

        // Always show starter suggestions, even when
        // the shop catalog is empty.
        setQuickItems(
          getStarterQuickItems(currentItems)
        );

        // Smart ranking is optional. Failure here
        // must not prevent adding Udhaar.
        try {
          const suggestions =
            await quickItemsService.execute({
              shopId: identity.shopId,
              customerId,
              availableItems: currentItems,
            });

          if (cancelled) return;

          if (suggestions.length > 0) {
          setQuickItems(
            suggestions.slice(0, QUICK_ITEMS_VISIBLE_LIMIT)
          );
        }
        } catch (suggestionError) {
          console.warn(
            '[add-udhaar] quick items unavailable',
            suggestionError
          );
        }
      } catch (cause) {
        if (cancelled) return;

        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load customer'
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
    };
  }, [customerId]);

  const parsedAmount = Number(amount.trim());

  const validAmount =
    amount.trim().length > 0 &&
    Number.isSafeInteger(parsedAmount) &&
    parsedAmount > 0;

  // Only confirmed items appear in Added items.
  const selectedItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.source === 'selected' &&
          item.name.trim().length > 0
      ),
    [items]
  );

  // Only unfinished editors appear as text fields.
  const draftItems = useMemo(
    () =>
      items.filter(
        (item) => item.source === 'editor'
      ),
    [items]
  );

  const addItemRow = useCallback(() => {
    setItems((current) => [
      ...current,
      emptyItem(),
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((current) =>
      current.filter((item) => item.id !== id)
    );
  }, []);

  const clearItems = useCallback(() => {
    setItems([]);
  }, []);

  const changeItemName = useCallback(
    (id: string, name: string) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                name,
                itemId: null,
                source: 'editor',
              }
            : item
        )
      );
    },
    []
  );

  // Confirm a manually typed custom item.
  // No modal or database write is needed.
  const confirmItem = useCallback((id: string) => {
    setItems((current) => {
      const target = current.find(
        (item) => item.id === id
      );

      if (!target) return current;

      const name = target.name.trim();

      if (!name) return current;

      const normalized = normalizeName(name);

      const alreadySelected = current.some(
        (item) =>
          item.id !== id &&
          item.source === 'selected' &&
          normalizeName(item.name) === normalized
      );

      if (alreadySelected) {
        // Remove the duplicate editor, preserving
        // the existing selected item.
        return current.filter(
          (item) => item.id !== id
        );
      }

      const catalogItem = availableItems.find(
        (item) =>
          normalizeName(item.name) === normalized
      );

      return current.map((item) =>
        item.id === id
          ? {
              ...item,
              name: catalogItem?.name ?? name,
              itemId: catalogItem?.id ?? null,
              source: 'selected',
            }
          : item
      );
    });
  }, [availableItems]);

  const selectItem = useCallback(
    (draftId: string, item: Item) => {
      setItems((current) => {
        const normalized = normalizeName(item.name);

        const alreadySelected = current.some(
          (draft) =>
            draft.id !== draftId &&
            draft.source === 'selected' &&
            (draft.itemId === item.id ||
              normalizeName(draft.name) === normalized)
        );

        if (alreadySelected) {
          return current.filter(
            (draft) => draft.id !== draftId
          );
        }

        return current.map((draft) =>
          draft.id === draftId
            ? {
                ...draft,
                itemId: item.id,
                name: item.name,
                source: 'selected',
              }
            : draft
        );
      });
    },
    []
  );

  const toggleAvailableItem = useCallback(
    (item: Item) => {
      setItems((current) => {
        const normalized = normalizeName(item.name);

        const existing = current.find(
          (draft) =>
            (draft.itemId === item.id ||
              normalizeName(draft.name) === normalized) &&
            draft.source === 'selected'
        );

        if (existing) {
          return current.filter(
            (draft) => draft.id !== existing.id
          );
        }

        // If the item is being typed already,
        // convert that editor to a selection.
        const editor = current.find(
          (draft) =>
            draft.source === 'editor' &&
            normalizeName(draft.name) === normalized
        );

        if (editor) {
          return current.map((draft) =>
            draft.id === editor.id
              ? {
                  ...draft,
                  itemId: item.id,
                  name: item.name,
                  source: 'selected',
                }
              : draft
          );
        }

        return [
          ...current,
          {
            id: Crypto.randomUUID(),
            itemId: item.id,
            name: item.name,
            source: 'selected',
          },
        ];
      });
    },
    []
  );

  const toggleQuickItem = useCallback(
    (quickItem: QuickItem) => {
      setItems((current) => {
        const normalized = normalizeName(
          quickItem.name
        );

        const existing = current.find(
          (draft) =>
            draft.source === 'selected' &&
            ((quickItem.id !== null &&
              draft.itemId === quickItem.id) ||
              normalizeName(draft.name) === normalized)
        );

        if (existing) {
          return current.filter(
            (draft) => draft.id !== existing.id
          );
        }

        const catalogItem = availableItems.find(
          (item) =>
            normalizeName(item.name) === normalized
        );

        // Avoid duplicating a matching open editor.
        const editor = current.find(
          (draft) =>
            draft.source === 'editor' &&
            normalizeName(draft.name) === normalized
        );

        const itemId =
          catalogItem?.id ??
          quickItem.id ??
          null;

        const name =
          catalogItem?.name ??
          quickItem.name;

        if (editor) {
          return current.map((draft) =>
            draft.id === editor.id
              ? {
                  ...draft,
                  itemId,
                  name,
                  source: 'selected',
                }
              : draft
          );
        }

        return [
          ...current,
          {
            id: Crypto.randomUUID(),
            itemId,
            name,
            source: 'selected',
          },
        ];
      });
    },
    [availableItems]
  );

  const save = useCallback(async () => {
    if (savingRef.current) return false;

    if (!customerId || !shopId || !deviceId) {
      throw new Error(
        'Customer or device is not ready'
      );
    }

    const value = Number(amount.trim());

    if (
      !amount.trim() ||
      !Number.isSafeInteger(value) ||
      value <= 0
    ) {
      throw new Error(
        'Enter a valid whole rupee amount'
      );
    }

    savingRef.current = true;
    setSaving(true);

    try {
      const preparedItems: CreateUdhaarItemInput[] = [];
      const knownItems = [...availableItems];
      const seenNames = new Set<string>();

      // Include confirmed selections and any
      // non-empty editor still being typed.
      // This preserves quick, frictionless saving.
      for (const draft of items) {
        const name = draft.name.trim();

        if (!name) continue;

        const normalized = normalizeName(name);

        if (seenNames.has(normalized)) {
          continue;
        }

        seenNames.add(normalized);

        let itemId = draft.itemId;

        if (!itemId) {
          const existing = knownItems.find(
            (item) =>
              normalizeName(item.name) === normalized
          );

          if (existing) {
            itemId = existing.id;
          } else {
            const created =
              await createItemService.execute({
                shopId,
                deviceId,
                name,
              });

            itemId = created.id;
            knownItems.push(created);
          }
        }

        preparedItems.push({
          itemId,
          name,
        });
      }

      await createUdhaarService.execute({
        shopId,
        customerId,
        deviceId,
        amount: value,
        items: preparedItems,
      });

      return true;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    amount,
    availableItems,
    customerId,
    deviceId,
    items,
    shopId,
  ]);

  return {
    customer,
    balance,
    amount,
    setAmount,

    items,
    availableItems,
    quickItems,
    selectedItems,
    draftItems,

    loading,
    saving,
    error,
    validAmount,
    parsedAmount,

    addItemRow,
    removeItem,
    clearItems,
    changeItemName,
    confirmItem,
    selectItem,
    toggleAvailableItem,
    toggleQuickItem,

    save,
  };
}
