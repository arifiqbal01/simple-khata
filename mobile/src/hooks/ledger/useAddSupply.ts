
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as Crypto from 'expo-crypto';

import { PartyRepository } from '@/repositories/party/party';
import {
  SupplierItemRepository,
  type SupplierItemWithDetails,
} from '@/repositories/item/supplier-item';
import { LedgerSummaryRepository } from '@/repositories/ledger/ledger-summary';
import { LocalIdentityRepository } from '@/repositories/bootstrap/local-identity';

import { CreateSupplyService } from '@/services/ledger/create-supply';

import type { DraftSupplyItem } from '@/components/ledger/supply/types';

type SupplierParty = NonNullable<
  Awaited<ReturnType<PartyRepository['getByIdAndShop']>>
>;

export type AvailableSupplyItem = SupplierItemWithDetails;

const partyRepository = new PartyRepository();
const supplierItemRepository = new SupplierItemRepository();
const ledgerSummaryRepository =
  new LedgerSummaryRepository();
const identityRepository = new LocalIdentityRepository();
const createSupplyService = new CreateSupplyService();

const PAGE_SIZE = 100;

function createEmptyItem(): DraftSupplyItem {
  return {
    id: Crypto.randomUUID(),
    itemId: null,
    name: '',
    quantity: '',
    unit: '',
    unitPrice: '',
  };
}

function parsePositiveNumber(value: string): number {
  const normalized = value.trim();

  if (!normalized) {
    return NaN;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : NaN;
}

function parseMoney(value: string): number {
  const normalized = value.trim();

  if (!normalized) {
    return NaN;
  }

  const parsed = Number(normalized);

  return Number.isSafeInteger(parsed) && parsed >= 0
    ? parsed
    : NaN;
}

function isEmptyItem(item: DraftSupplyItem): boolean {
  return (
    item.itemId === null &&
    item.name.trim().length === 0 &&
    item.quantity.trim().length === 0 &&
    item.unitPrice.trim().length === 0
  );
}

function isValidItem(item: DraftSupplyItem): boolean {
  if (
    !item.itemId ||
    !item.name.trim() ||
    item.name.trim().length > 150 ||
    !item.unit.trim()
  ) {
    return false;
  }

  const quantity = parsePositiveNumber(item.quantity);
  const unitPrice = parseMoney(item.unitPrice);
  const amount = quantity * unitPrice;

  return (
    Number.isFinite(quantity) &&
    quantity > 0 &&
    Number.isSafeInteger(unitPrice) &&
    unitPrice >= 0 &&
    Number.isSafeInteger(amount) &&
    amount >= 0
  );
}

async function loadSupplierProducts(
  shopId: string,
  supplierId: string
): Promise<AvailableSupplyItem[]> {
  const results: AvailableSupplyItem[] = [];
  let offset = 0;

  while (true) {
    const page =
      await supplierItemRepository.listBySupplier(
        shopId,
        supplierId,
        PAGE_SIZE,
        offset
      );

    results.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += page.length;
  }

  return results;
}

export function useAddSupply(supplierId?: string) {
  const [shopId, setShopId] =
    useState<string | null>(null);

  const [deviceId, setDeviceId] =
    useState<string | null>(null);

  const [supplier, setSupplier] =
    useState<SupplierParty | null>(null);

  const [balance, setBalance] = useState(0);

  const [items, setItems] =
    useState<DraftSupplyItem[]>([
      createEmptyItem(),
    ]);

  const [availableItems, setAvailableItems] =
    useState<AvailableSupplyItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const savingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function initialize(): Promise<void> {
      setLoading(true);
      setError(null);

      setSupplier(null);
      setShopId(null);
      setDeviceId(null);
      setBalance(0);
      setItems([createEmptyItem()]);
      setAvailableItems([]);

      try {
        if (!supplierId?.trim()) {
          throw new Error('Supplier ID is missing');
        }

        const identity =
          await identityRepository.get();

        if (
          !identity ||
          !identity.shopId?.trim() ||
          !identity.deviceId?.trim()
        ) {
          throw new Error(
            'Local installation identity not found'
          );
        }

        const currentSupplier =
          await partyRepository.getByIdAndShop(
            supplierId,
            identity.shopId
          );

        if (
          !currentSupplier ||
          currentSupplier.type !== 'SUPPLIER'
        ) {
          throw new Error('Supplier not found');
        }

        const [currentBalance, supplierProducts] =
          await Promise.all([
            ledgerSummaryRepository.getSupplierBalance(
              identity.shopId,
              supplierId
            ),
            loadSupplierProducts(
              identity.shopId,
              supplierId
            ),
          ]);

        if (cancelled) {
          return;
        }

        setShopId(identity.shopId);
        setDeviceId(identity.deviceId);
        setSupplier(currentSupplier);
        setBalance(currentBalance);
        setAvailableItems(supplierProducts);
      } catch (cause) {
        if (cancelled) {
          return;
        }

        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load supplier'
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
  }, [supplierId]);

  const addItemRow = useCallback(() => {
    setItems((current) => [
      ...current,
      createEmptyItem(),
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((current) => {
      const remaining = current.filter(
        (item) => item.id !== id
      );

      return remaining.length > 0
        ? remaining
        : [createEmptyItem()];
    });
  }, []);

  const clearItems = useCallback(() => {
    setItems([createEmptyItem()]);
  }, []);

  const updateItem = useCallback(
    (
      id: string,
      changes: Partial<DraftSupplyItem>
    ) => {
      // Only quantity is directly editable in this flow.
      // Product, unit and price are sourced from the
      // supplier's configured product association.
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(changes.quantity !== undefined
                  ? { quantity: changes.quantity }
                  : {}),
              }
            : item
        )
      );
    },
    []
  );

  const changeItemName = useCallback(
    (id: string, _name: string) => {
      // Free-text products are intentionally disabled.
      // Keep the method for compatibility with callers.
      void id;
      void _name;
    },
    []
  );

  const selectItem = useCallback(
    (
      id: string,
      selected: AvailableSupplyItem
    ) => {
      // Resolve against the loaded supplier associations
      // rather than trusting an arbitrary catalog item.
      const supplierProduct = availableItems.find(
        (entry) => entry.id === selected.id
      );

      if (!supplierProduct) {
        return;
      }

      setItems((current) =>
        current.map((draft) =>
          draft.id === id
            ? {
                ...draft,
                itemId: supplierProduct.item_id,
                name: supplierProduct.item_name,
                unit: supplierProduct.unit,
                unitPrice: String(
                  supplierProduct.unit_price
                ),
              }
            : draft
        )
      );
    },
    [availableItems]
  );

  const preparedItems = useMemo(() => {
    return items
      .filter((item) => !isEmptyItem(item))
      .map((item) => {
        const quantity =
          parsePositiveNumber(item.quantity);

        const unitPrice =
          parseMoney(item.unitPrice);

        const amount = quantity * unitPrice;

        return {
          itemId: item.itemId,
          name: item.name.trim(),
          quantity,
          unit: item.unit.trim(),
          unitPrice,
          amount,
        };
      });
  }, [items]);

  const totalAmount = useMemo(() => {
    return preparedItems.reduce(
      (total, item) => total + item.amount,
      0
    );
  }, [preparedItems]);

  const validItems = useMemo(() => {
    const filledItems = items.filter(
      (item) => !isEmptyItem(item)
    );

    if (filledItems.length === 0) {
      return false;
    }

    return filledItems.every((item) => {
      if (!isValidItem(item)) {
        return false;
      }

      // Verify the selected product still belongs
      // to this supplier and matches its configuration.
      return availableItems.some(
        (supplierProduct) =>
          supplierProduct.item_id === item.itemId &&
          supplierProduct.item_name === item.name &&
          supplierProduct.unit === item.unit &&
          supplierProduct.unit_price ===
            Number(item.unitPrice)
      );
    });
  }, [items, availableItems]);

  const validAmount =
    validItems &&
    Number.isSafeInteger(totalAmount) &&
    totalAmount > 0;

  const projectedBalance = validAmount
    ? balance + totalAmount
    : balance;

  const save = useCallback(
    async (): Promise<boolean> => {
      if (savingRef.current) {
        return false;
      }

      if (
        !supplierId?.trim() ||
        !shopId?.trim() ||
        !deviceId?.trim() ||
        !supplier ||
        supplier.type !== 'SUPPLIER'
      ) {
        throw new Error(
          'Supplier or device is not ready'
        );
      }

      if (!validAmount) {
        throw new Error(
          'Select a supplier product and enter a valid quantity for each item'
        );
      }

      savingRef.current = true;
      setSaving(true);

      try {
        await createSupplyService.execute({
          shopId,
          partyId: supplierId,
          deviceId,
          amount: totalAmount,
          items: preparedItems,
        });

        return true;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [
      supplierId,
      shopId,
      deviceId,
      supplier,
      validAmount,
      totalAmount,
      preparedItems,
    ]
  );

  return {
    supplier,
    balance,

    items,
    availableItems,
    preparedItems,

    totalAmount,
    projectedBalance,

    loading,
    saving,
    error,

    validItems,
    validAmount,

    addItemRow,
    removeItem,
    clearItems,
    updateItem,
    changeItemName,
    selectItem,

    save,
  };
}
