
import { runWriteTransaction } from '@/db/write-transaction';
import type { SyncOperationType } from './sync-outbox';
import {
  repairLegacyQuantity,
} from '@/utils/ledger/quantity-precision';

interface OutboxRow {
  id: string;
  operation_type: SyncOperationType;
  payload: string;
}

interface LocalItemRow {
  quantity: string | null;
}

type JsonObject = Record<string, any>;

function isObject(value: unknown): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function normalizeLedgerEntry(
  entry: JsonObject
): JsonObject {
  return {
    id: entry.id,
    partyId:
      entry.partyId ??
      entry.party_id ??
      entry.customerId ??
      entry.customer_id,
    deviceId: entry.deviceId ?? entry.device_id,
    type: entry.type,
    amount: entry.amount,
    note: entry.note ?? null,
    occurredAt:
      entry.occurredAt ?? entry.occurred_at,
    createdAt:
      entry.createdAt ?? entry.created_at,
  };
}

function isValidQuantity(value: number): boolean {
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 999_999_999.999
  ) {
    return false;
  }

  const scaled = value * 1000;

  return Math.abs(
    scaled - Math.round(scaled)
  ) < 1e-7;
}

export async function repairLegacyOutboxPayloads(): Promise<number> {
  let repairedCount = 0;

  /*
   * Read and update within the same transaction.
   * Preserve the existing outbox rows and their order.
   */
  await runWriteTransaction(async (db) => {
    const rows = await db.getAllAsync<OutboxRow>(
      `
        SELECT
          id,
          operation_type,
          payload
        FROM sync_outbox
        WHERE operation_type IN (
          'CUSTOMER_CREATE',
          'CUSTOMER_UPDATE',
          'ITEM_CREATE',
          'ITEM_UPDATE',
          'LEDGER_ENTRY_CREATE'
        )
        ORDER BY rowid ASC
      `
    );

    for (const row of rows) {
      let payload: unknown;

      try {
        payload = JSON.parse(row.payload);
      } catch {
        console.warn(
          '[sync-outbox] invalid JSON payload',
          row.id
        );
        continue;
      }

      if (!isObject(payload)) {
        console.warn(
          '[sync-outbox] invalid payload structure',
          row.id
        );
        continue;
      }

      let changed = false;

      /*
       * Repair legacy customer payloads.
       */
      if (
        (
          row.operation_type === 'CUSTOMER_CREATE' ||
          row.operation_type === 'CUSTOMER_UPDATE'
        ) &&
        isObject(payload.customer)
      ) {
        const customer = payload.customer;

        if (
          customer.shop_id !== undefined ||
          customer.created_at !== undefined ||
          customer.updated_at !== undefined
        ) {
          payload.customer = {
            id: customer.id,
            shopId:
              customer.shopId ?? customer.shop_id,
            name: customer.name,
            phone: customer.phone ?? null,
            createdAt:
              customer.createdAt ??
              customer.created_at,
            updatedAt:
              customer.updatedAt ??
              customer.updated_at,
          };

          changed = true;
        }
      }

      /*
       * Repair legacy item payloads.
       */
      if (
        (
          row.operation_type === 'ITEM_CREATE' ||
          row.operation_type === 'ITEM_UPDATE'
        ) &&
        isObject(payload.item)
      ) {
        const item = payload.item;

        if (
          item.shop_id !== undefined ||
          item.created_at !== undefined ||
          !item.updatedAt
        ) {
          const createdAt =
            item.createdAt ?? item.created_at;

          payload.item = {
            id: item.id,
            shopId:
              item.shopId ?? item.shop_id,
            name: item.name,
            createdAt,
            updatedAt:
              item.updatedAt ??
              item.updated_at ??
              createdAt,
          };

          changed = true;
        }
      }

      /*
       * Repair ledger entries and their item snapshots.
       */
      if (
        row.operation_type === 'LEDGER_ENTRY_CREATE' &&
        isObject(payload.entry)
      ) {
        const originalEntry = payload.entry;
        const normalizedEntry =
          normalizeLedgerEntry(originalEntry);

        /*
         * Avoid silently replacing malformed identity
         * fields with undefined.
         */
        if (
          typeof normalizedEntry.id !== 'string' ||
          typeof normalizedEntry.partyId !== 'string' ||
          typeof normalizedEntry.deviceId !== 'string' ||
          typeof normalizedEntry.occurredAt !== 'string' ||
          typeof normalizedEntry.createdAt !== 'string'
        ) {
          console.warn(
            '[sync-outbox] ledger entry needs manual review',
            row.id
          );
          continue;
        }

        if (
          JSON.stringify(originalEntry) !==
          JSON.stringify(normalizedEntry)
        ) {
          payload.entry = normalizedEntry;
          changed = true;
        }

        if (Array.isArray(payload.items)) {
          const repairedItems: JsonObject[] = [];
          let unsafe = false;

          /*
           * Validate all items before changing any
           * local quantity or outbox payload.
           */
          const quantityUpdates: Array<{
            id: string;
            ledgerEntryId: string;
            originalQuantity: string;
            repairedQuantity: number;
          }> = [];

          for (const rawItem of payload.items) {
            if (!isObject(rawItem)) {
              unsafe = true;
              break;
            }

            const item = { ...rawItem };

            if (
              typeof item.id !== 'string' ||
              !item.id.trim()
            ) {
              unsafe = true;
              break;
            }

            if (!item.ledgerEntryId) {
              item.ledgerEntryId = normalizedEntry.id;
              changed = true;
            }

            if (
              item.ledgerEntryId !== normalizedEntry.id
            ) {
              unsafe = true;
              break;
            }

            if (!item.itemName && item.name) {
              item.itemName = item.name;
              changed = true;
            }

            if (!item.createdAt) {
              item.createdAt = normalizedEntry.createdAt;
              changed = true;
            }

            if ('name' in item) {
              delete item.name;
              changed = true;
            }

            /*
             * Preserve missing quantities as null.
             */
            if (
              item.quantity !== null &&
              item.quantity !== undefined
            ) {
              if (
                typeof item.quantity !== 'number' ||
                !Number.isFinite(item.quantity) ||
                item.quantity <= 0
              ) {
                unsafe = true;
                break;
              }

              if (!isValidQuantity(item.quantity)) {
                const repairedQuantity =
                  repairLegacyQuantity(item.quantity);

                if (
                  repairedQuantity === null ||
                  !isValidQuantity(repairedQuantity)
                ) {
                  unsafe = true;
                  break;
                }

                quantityUpdates.push({
                  id: item.id,
                  ledgerEntryId: normalizedEntry.id,
                  originalQuantity: String(item.quantity),
                  repairedQuantity,
                });

                item.quantity = repairedQuantity;
                changed = true;
              }
            }

            repairedItems.push(item);
          }

          if (unsafe) {
            console.warn(
              '[sync-outbox] unsafe ledger item; repair skipped',
              row.id
            );
            continue;
          }

          /*
           * Check that every affected local item exists
           * and still contains the expected old quantity.
           *
           * Never create replacement item rows.
           */
          let localRowsMatch = true;

          for (const update of quantityUpdates) {
            const local = await db.getFirstAsync<LocalItemRow>(
              `
                SELECT quantity
                FROM entry_items
                WHERE id = ?
                  AND ledger_entry_id = ?
                LIMIT 1
              `,
              update.id,
              update.ledgerEntryId
            );

            if (
              !local ||
              local.quantity === null ||
              !Number.isFinite(Number(local.quantity)) ||
              Number(local.quantity) !==
                Number(update.originalQuantity)
            ) {
              localRowsMatch = false;
              break;
            }
          }

          if (!localRowsMatch) {
            console.warn(
              '[sync-outbox] local quantity mismatch; repair skipped',
              row.id
            );
            continue;
          }

          /*
           * Apply local quantity changes in the same
           * transaction as the outbox payload update.
           */
          for (const update of quantityUpdates) {
            const result = await db.runAsync(
              `
                UPDATE entry_items
                SET quantity = ?
                WHERE id = ?
                  AND ledger_entry_id = ?
                  AND CAST(quantity AS REAL) = ?
              `,
              String(update.repairedQuantity),
              update.id,
              update.ledgerEntryId,
              Number(update.originalQuantity)
            );

            if (result.changes !== 1) {
              throw new Error(
                `Quantity repair failed for item ${update.id}`
              );
            }

            console.log(
              '[sync-outbox] quantity repaired',
              {
                operationId: row.id,
                itemId: update.id,
                from: update.originalQuantity,
                to: update.repairedQuantity,
              }
            );
          }

          payload.items = repairedItems;
        }
      }

      if (!changed) {
        continue;
      }

      /*
       * Update the existing operation.
       *
       * Do not change operation ID, entity ID,
       * insertion order, or monetary amounts.
       */
      const result = await db.runAsync(
        `
          UPDATE sync_outbox
          SET
            payload = ?,
            next_attempt_at = NULL,
            last_error = NULL
          WHERE id = ?
            AND payload = ?
        `,
        JSON.stringify(payload),
        row.id,
        row.payload
      );

      if (result.changes !== 1) {
        throw new Error(
          `Outbox repair failed for operation ${row.id}`
        );
      }

      repairedCount += 1;

      console.log(
        '[sync-outbox] repaired',
        row.id,
        row.operation_type
      );
    }
  });

  return repairedCount;
}
