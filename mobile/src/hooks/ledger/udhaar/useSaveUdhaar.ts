
import {
  useCallback,
  useRef,
  useState,
} from 'react';

import type { Item } from '@/types/domain';

import { ItemRepository } from '@/repositories/item/item';
import { LedgerRepository } from '@/repositories/ledger/ledger';
import { PartyRepository } from '@/repositories/party/party';
import { syncOutboxRepository } from '@/repositories/sync/sync-outbox';

import { CreateItemService } from '@/services/item/create';
import { UpdateItemService } from '@/services/item/update';

import {
  CreateUdhaarService,
  type CreateUdhaarItemInput,
} from '@/services/ledger/create-udhaar';

import type {
  DraftUdhaarItem,
  UdhaarCustomerState,
  UdhaarEntryMode,
  UdhaarTotalsState,
} from './types';

import {
  normalizeName,
  parseLine,
  parseQuantity,
  parseUnitPrice,
  parseWholeRupees,
} from './utils';

const itemRepository = new ItemRepository();

const createItemService = new CreateItemService(
  itemRepository,
  syncOutboxRepository
);

const updateItemService = new UpdateItemService(
  itemRepository,
  syncOutboxRepository
);

const createUdhaarService = new CreateUdhaarService(
  new LedgerRepository(),
  new PartyRepository(),
  syncOutboxRepository
);

interface UseSaveUdhaarInput {
  customerId?: string;
  customerState: UdhaarCustomerState;
  availableItems: Item[];
  items: DraftUdhaarItem[];
  totals: UdhaarTotalsState;
  mode: UdhaarEntryMode;
}

export function useSaveUdhaar({
  customerId,
  customerState,
  availableItems,
  items,
  totals,
  mode,
}: UseSaveUdhaarInput) {
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const {
    shopId,
    deviceId,
    customer,
  } = customerState;

  const {
    effectiveAmount,
    validAmount,
    hasSelectedItems,
  } = totals;

  const save = useCallback(
    async (): Promise<boolean> => {
      if (savingRef.current) {
        return false;
      }

      if (
        !customerId ||
        !shopId ||
        !deviceId ||
        !customer ||
        customer.type !== 'CUSTOMER'
      ) {
        throw new Error(
          'Customer or device is not ready'
        );
      }

      if (
        !validAmount ||
        !Number.isSafeInteger(effectiveAmount) ||
        effectiveAmount <= 0
      ) {
        throw new Error(
          hasSelectedItems
            ? mode === 'amount'
              ? 'Enter a valid whole-rupee amount for every selected item'
              : 'Enter a valid quantity, unit and price for every selected item'
            : 'Enter a valid whole rupee amount'
        );
      }

      if (
        hasSelectedItems &&
        items.some(
          (item) =>
            item.source === 'editor' &&
            item.name.trim().length > 0
        )
      ) {
        throw new Error(
          'Confirm or remove unfinished item fields before saving'
        );
      }

      savingRef.current = true;
      setSaving(true);

      try {
        const preparedItems: CreateUdhaarItemInput[] = [];
        const seenNames = new Set<string>();

        const knownById = new Map<string, Item>();
        const knownByName = new Map<string, Item>();

        for (const item of availableItems) {
          if (
            item.shop_id !== shopId ||
            item.deleted_at != null
          ) {
            continue;
          }

          knownById.set(item.id, item);
          knownByName.set(
            normalizeName(item.name),
            item
          );
        }

        for (const draft of items) {
          if (draft.source !== 'selected') {
            continue;
          }

          const name = draft.name.trim();

          if (!name) {
            throw new Error(
              'Selected item name is required'
            );
          }

          const normalized = normalizeName(name);

          if (seenNames.has(normalized)) {
            throw new Error(
              `Remove duplicate item: ${name}`
            );
          }

          seenNames.add(normalized);

          const lineTotal = parseLine(draft, mode);

          if (lineTotal === null) {
            throw new Error(
              mode === 'amount'
                ? `Enter a valid rupee amount for ${name}`
                : `Enter valid quantity, unit and price for ${name}`
            );
          }

          const unit = draft.unit.trim() || null;

          const priceText = draft.unitPrice.trim();

          const unitPrice =
            priceText.length === 0
              ? null
              : parseUnitPrice(priceText);

          if (
            priceText.length > 0 &&
            unitPrice === null
          ) {
            throw new Error(
              `Enter a valid selling price for ${name}`
            );
          }

          let quantity: number | null = null;

          if (mode === 'quantity') {
            quantity = parseQuantity(
              draft.quantity
            );

            if (
              quantity === null ||
              unit === null ||
              unitPrice === null
            ) {
              throw new Error(
                `Enter valid quantity, unit and price for ${name}`
              );
            }
          } else {
            const amount = parseWholeRupees(
              draft.amount
            );

            if (
              amount === null ||
              amount <= 0
            ) {
              throw new Error(
                `Enter a valid rupee amount for ${name}`
              );
            }

            // Derived quantities are approximate.
            // Save them only when a valid unit and
            // selling price are available.
            if (
              unit !== null &&
              unitPrice !== null &&
              unitPrice > 0
            ) {
              const parsedQuantity = parseQuantity(
                draft.quantity
              );

              quantity = parsedQuantity;
            }
          }

          // Preserve missing values as null.
          // Do not manufacture a zero price or
          // quantity for amount-only items.

          let catalogItem: Item | null = null;

          if (draft.itemId) {
            catalogItem =
              knownById.get(draft.itemId) ??
              await itemRepository.getByIdAndShop(
                draft.itemId,
                shopId
              );
          }

          if (!catalogItem) {
            catalogItem =
              knownByName.get(normalized) ??
              await itemRepository.getByNameAndShop(
                shopId,
                name
              );
          }

          if (!catalogItem) {
            catalogItem =
              await createItemService.execute({
                shopId,
                deviceId,
                name,
                defaultUnit: unit,
                defaultSellingPrice: unitPrice,
              });
          } else {
            const missingUnit =
              !catalogItem.default_unit?.trim();

            const missingPrice =
              catalogItem.default_selling_price == null;

            const shouldUpdateUnit =
              missingUnit && unit !== null;

            const shouldUpdatePrice =
              missingPrice && unitPrice !== null;

            if (
              shouldUpdateUnit ||
              shouldUpdatePrice
            ) {
              catalogItem =
                await updateItemService.execute({
                  shopId,
                  deviceId,
                  itemId: catalogItem.id,
                  name: catalogItem.name,
                  defaultUnit:
                    shouldUpdateUnit
                      ? unit
                      : catalogItem.default_unit ?? null,
                  defaultSellingPrice:
                    shouldUpdatePrice
                      ? unitPrice
                      : catalogItem.default_selling_price ?? null,
                });
            }
          }

          knownById.set(
            catalogItem.id,
            catalogItem
          );

          knownByName.set(
            normalizeName(catalogItem.name),
            catalogItem
          );

          preparedItems.push({
            itemId: catalogItem.id,
            name: catalogItem.name,
            amount: lineTotal,
            quantity,
            unit,
            unitPrice,
          });
        }

        if (hasSelectedItems) {
          if (preparedItems.length === 0) {
            throw new Error(
              'Select at least one valid item'
            );
          }

          const calculatedTotal =
            preparedItems.reduce(
              (sum, item) =>
                sum + (item.amount ?? 0),
              0
            );

          if (
            !Number.isSafeInteger(calculatedTotal) ||
            calculatedTotal !== effectiveAmount
          ) {
            throw new Error(
              'Calculated Udhaar amount has changed. Please review the items.'
            );
          }
        }

        await createUdhaarService.execute({
          shopId,
          partyId: customerId,
          deviceId,
          amount: effectiveAmount,
          items: preparedItems,
        });

        return true;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [
      customerId,
      shopId,
      deviceId,
      customer,
      validAmount,
      effectiveAmount,
      hasSelectedItems,
      items,
      availableItems,
      mode,
    ]
  );

  return {
    saving,
    save,
  };
}
