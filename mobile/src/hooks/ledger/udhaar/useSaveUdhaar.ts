
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
  UdhaarTotalsState,
} from './types';

import {
  normalizeName,
  parseLine,
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
}

export function useSaveUdhaar({
  customerId,
  customerState,
  availableItems,
  items,
  totals,
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
            ? 'Enter a valid quantity, unit and price for every selected item'
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

        /*
         * Cache catalog products already loaded
         * by the screen.
         */
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

        /*
         * Validate selected items and calculate
         * transaction values.
         */
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

          const lineTotal = parseLine(draft);

          if (lineTotal === null) {
            throw new Error(
              `Enter valid quantity, unit and price for ${name}`
            );
          }

          const quantity = Number(
            draft.quantity.trim()
          );

          const unit = draft.unit.trim();

          const unitPrice = Number(
            draft.unitPrice.trim()
          );

          /*
           * Find existing catalog product by ID,
           * then by name, including SQLite lookups
           * outside the initial catalog page.
           */
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
            /*
             * NEW PRODUCT
             *
             * Save the selected unit and price as
             * permanent catalog defaults.
             */
            catalogItem =
              await createItemService.execute({
                shopId,
                deviceId,
                name,
                defaultUnit: unit,
                defaultSellingPrice: unitPrice,
              });
          } else {
            /*
             * EXISTING PRODUCT
             *
             * Fill missing catalog defaults only.
             * Never overwrite an existing unit
             * or existing selling price.
             */
            const missingUnit =
              !catalogItem.default_unit?.trim();

            const missingPrice =
              catalogItem.default_selling_price == null;

            if (missingUnit || missingPrice) {
              const updatedUnit = missingUnit
                  ? unit
                  : catalogItem.default_unit ?? null;

                const updatedPrice = missingPrice
                  ? unitPrice
                  : catalogItem.default_selling_price ?? null;

              catalogItem =
                await updateItemService.execute({
                  shopId,
                  deviceId,
                  itemId: catalogItem.id,
                  name: catalogItem.name,
                  defaultUnit: updatedUnit,
                  defaultSellingPrice: updatedPrice,
                });
            }
          }

          /*
           * Refresh the local cache with the
           * newly created or updated catalog item.
           */
          knownById.set(
            catalogItem.id,
            catalogItem
          );

          knownByName.set(
            normalizeName(catalogItem.name),
            catalogItem
          );

          /*
           * Transaction values remain separate
           * from catalog defaults.
           */
          preparedItems.push({
            itemId: catalogItem.id,
            name: catalogItem.name,
            quantity,
            unit,
            unitPrice,
            amount: lineTotal,
          });
        }

        /*
         * Verify the itemized total before
         * creating the ledger entry.
         */
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

        /*
         * Save the Udhaar ledger transaction.
         */
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
    ]
  );

  return {
    saving,
    save,
  };
}
