
import {
  useCallback,
  useRef,
  useState,
} from 'react';

import {
  CreateSupplyService,
  type CreateSupplyItemInput,
} from '@/services/ledger/create-supply';

import type {
  AvailableSupplyItem,
  DraftSupplyItem,
  SupplyEntryMode,
} from './types';

import {
  isEmptySupplyItem,
  isValidSupplyItem,
  parseSupplyLine,
  parseQuantity,
  parseUnitPrice,
} from './utils';

const createSupplyService =
  new CreateSupplyService();

interface UseSaveSupplyInput {
  shopId: string | null;
  deviceId: string | null;
  supplierId?: string;
  supplierValid: boolean;
  items: DraftSupplyItem[];
  mode: SupplyEntryMode;
  availableItems: AvailableSupplyItem[];
  catalogLoading: boolean;
  validAmount: boolean;
  totalAmount: number;
}

export interface SaveSupplyState {
  saving: boolean;
  error: string | null;
  save: () => Promise<boolean>;
}

export function useSaveSupply({
  shopId,
  deviceId,
  supplierId,
  supplierValid,
  items,
  mode,
  availableItems,
  catalogLoading,
  validAmount,
  totalAmount,
}: UseSaveSupplyInput): SaveSupplyState {
  const [saving, setSaving] = useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const savingRef = useRef(false);

  const save = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) {
      return false;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);

    try {
      if (!shopId || !deviceId) {
        throw new Error(
          'Local installation identity not found'
        );
      }

      if (!supplierId?.trim() || !supplierValid) {
        throw new Error('Supplier not found');
      }

      if (catalogLoading) {
        throw new Error(
          'Supplier products are still loading'
        );
      }

      if (
        !validAmount ||
        !Number.isSafeInteger(totalAmount) ||
        totalAmount <= 0
      ) {
        throw new Error('Invalid supply amount');
      }

      const selectedItems = items.filter(
        (item) => !isEmptySupplyItem(item)
      );

      if (selectedItems.length === 0) {
        throw new Error(
          'Select at least one supplier product'
        );
      }

      const preparedItems: CreateSupplyItemInput[] =
        [];

      let calculatedTotal = 0;

      for (const item of selectedItems) {
        if (!isValidSupplyItem(item, mode)) {
          throw new Error(
            'Complete all supplier item details'
          );
        }

        const configuredProduct =
          availableItems.find(
            (product) =>
              product.item_id === item.itemId &&
              product.item_name === item.name &&
              product.unit === item.unit &&
              String(product.unit_price) ===
                item.unitPrice
          );

        if (!configuredProduct) {
          throw new Error(
            'A selected product is no longer configured for this supplier'
          );
        }

        const amount = parseSupplyLine(
          item,
          mode
        );

        const quantity = parseQuantity(
          item.quantity
        );

        const unitPrice = parseUnitPrice(
          item.unitPrice
        );

        if (
          amount === null ||
          quantity === null ||
          unitPrice === null
        ) {
          throw new Error(
            'Invalid supply item amount or quantity'
          );
        }

        const nextTotal =
          calculatedTotal + amount;

        if (!Number.isSafeInteger(nextTotal)) {
          throw new Error(
            'Supply total exceeds the supported amount'
          );
        }

        calculatedTotal = nextTotal;

        preparedItems.push({
          itemId: configuredProduct.item_id,
          name: configuredProduct.item_name,
          quantity,
          unit: configuredProduct.unit,
          unitPrice,
          amount,
        });
      }

      if (calculatedTotal !== totalAmount) {
        throw new Error(
          'Supply item totals do not match'
        );
      }

      await createSupplyService.execute({
        shopId,
        partyId: supplierId.trim(),
        deviceId,
        amount: totalAmount,
        items: preparedItems,
      });

      return true;
    } catch (cause) {
      console.warn(
        '[add-supply] Saving failed:',
        cause
      );

      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not save supply'
      );

      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    shopId,
    deviceId,
    supplierId,
    supplierValid,
    items,
    mode,
    availableItems,
    catalogLoading,
    validAmount,
    totalAmount,
  ]);

  return {
    saving,
    error,
    save,
  };
}
