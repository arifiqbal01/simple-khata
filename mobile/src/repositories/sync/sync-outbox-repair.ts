import { runWriteTransaction } from '@/db/write-transaction';
import type { SyncOperationType } from './sync-outbox';
import {
  isValidSyncQuantity,
  toSyncQuantityString,
} from '@/utils/ledger/quantity-precision';

interface OutboxRow {
  id: string;
  operation_type: SyncOperationType;
  payload: string;
}

interface LocalItemRow {
  quantity: string | number | null;
}

type JsonObject = Record<string, unknown>;

interface QuantityUpdate {
  id: string;
  ledgerEntryId: string;
  originalQuantity: number | string;
  normalizedQuantity: string;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeLedgerEntry(entry: JsonObject): JsonObject {
  return {
    id: entry.id,
    partyId: entry.partyId ?? entry.party_id ?? entry.customerId ?? entry.customer_id,
    deviceId: entry.deviceId ?? entry.device_id,
    type: entry.type,
    amount: entry.amount,
    note: entry.note ?? null,
    occurredAt: entry.occurredAt ?? entry.occurred_at,
    createdAt: entry.createdAt ?? entry.created_at,
  };
}

/**
 * Only normalize a quantity that already represents a valid value
 * at three decimal places. Never round an arbitrary historical value.
 */
function canonicalQuantity(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!isValidSyncQuantity(value)) return null;
    return toSyncQuantityString(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return null;

    const numeric = Number(trimmed);
    if (!isValidSyncQuantity(numeric)) return null;

    // A string with more than three meaningful fractional digits is
    // not automatically repaired, even if Number() loses precision.
    const fraction = (trimmed.split('.')[1] ?? '').replace(/0+$/, '');
    if (fraction.length > 3) return null;

    return toSyncQuantityString(numeric);
  }

  return null;
}

export async function repairLegacyOutboxPayloads(): Promise<number> {
  let repairedCount = 0;

  await runWriteTransaction(async (db) => {
    const rows = await db.getAllAsync<OutboxRow>(`
      SELECT id, operation_type, payload
      FROM sync_outbox
      WHERE operation_type IN (
        'CUSTOMER_CREATE', 'CUSTOMER_UPDATE',
        'ITEM_CREATE', 'ITEM_UPDATE', 'LEDGER_ENTRY_CREATE'
      )
      ORDER BY rowid ASC
    `);

    for (const row of rows) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(row.payload);
      } catch {
        console.warn('[sync-outbox] invalid JSON payload', row.id);
        continue;
      }

      if (!isObject(parsed)) {
        console.warn('[sync-outbox] invalid payload structure', row.id);
        continue;
      }

      const payload = parsed;
      let changed = false;

      if (
        (row.operation_type === 'CUSTOMER_CREATE' ||
          row.operation_type === 'CUSTOMER_UPDATE') &&
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
            shopId: customer.shopId ?? customer.shop_id,
            name: customer.name,
            phone: customer.phone ?? null,
            createdAt: customer.createdAt ?? customer.created_at,
            updatedAt: customer.updatedAt ?? customer.updated_at,
          };
          changed = true;
        }
      }

      if (
        (row.operation_type === 'ITEM_CREATE' ||
          row.operation_type === 'ITEM_UPDATE') &&
        isObject(payload.item)
      ) {
        const item = payload.item;
        if (
          item.shop_id !== undefined ||
          item.created_at !== undefined ||
          !item.updatedAt
        ) {
          const createdAt = item.createdAt ?? item.created_at;
          payload.item = {
            id: item.id,
            shopId: item.shopId ?? item.shop_id,
            name: item.name,
            createdAt,
            updatedAt: item.updatedAt ?? item.updated_at ?? createdAt,
          };
          changed = true;
        }
      }

      if (
        row.operation_type === 'LEDGER_ENTRY_CREATE' &&
        isObject(payload.entry)
      ) {
        const originalEntry = payload.entry;
        const normalizedEntry = normalizeLedgerEntry(originalEntry);

        if (
          typeof normalizedEntry.id !== 'string' ||
          typeof normalizedEntry.partyId !== 'string' ||
          typeof normalizedEntry.deviceId !== 'string' ||
          typeof normalizedEntry.occurredAt !== 'string' ||
          typeof normalizedEntry.createdAt !== 'string'
        ) {
          console.warn('[sync-outbox] ledger entry needs manual review', row.id);
          continue;
        }

        if (JSON.stringify(originalEntry) !== JSON.stringify(normalizedEntry)) {
          payload.entry = normalizedEntry;
          changed = true;
        }

        if (Array.isArray(payload.items)) {
          const repairedItems: JsonObject[] = [];
          const quantityUpdates: QuantityUpdate[] = [];
          let unsafe = false;

          for (const rawItem of payload.items) {
            if (!isObject(rawItem) || typeof rawItem.id !== 'string' || !rawItem.id.trim()) {
              unsafe = true;
              break;
            }

            const item: JsonObject = { ...rawItem };

            if (!item.ledgerEntryId) {
              item.ledgerEntryId = normalizedEntry.id;
              changed = true;
            }
            if (item.ledgerEntryId !== normalizedEntry.id) {
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

            if (item.quantity !== null && item.quantity !== undefined) {
              const normalized = canonicalQuantity(item.quantity);
              if (normalized === null) {
                unsafe = true;
                break;
              }

              if (item.quantity !== normalized) {
                quantityUpdates.push({
                  id: rawItem.id,
                  ledgerEntryId: normalizedEntry.id,
                  originalQuantity: item.quantity as number | string,
                  normalizedQuantity: normalized,
                });
                item.quantity = normalized;
                changed = true;
              }
            }

            repairedItems.push(item);
          }

          if (unsafe) {
            console.warn('[sync-outbox] unsafe ledger item; repair skipped', row.id);
            continue;
          }

          // Check every affected snapshot before updating anything.
          // SQLite may return quantity as TEXT or REAL, depending on schema.
          let localRowsMatch = true;
          for (const update of quantityUpdates) {
            const local = await db.getFirstAsync<LocalItemRow>(`
              SELECT quantity FROM entry_items
              WHERE id = ? AND ledger_entry_id = ? LIMIT 1
            `, update.id, update.ledgerEntryId);

            if (
              !local ||
              local.quantity === null ||
              !Number.isFinite(Number(local.quantity)) ||
              Number(local.quantity) !== Number(update.originalQuantity)
            ) {
              localRowsMatch = false;
              break;
            }
          }

          if (!localRowsMatch) {
            console.warn('[sync-outbox] local quantity mismatch; repair skipped', row.id);
            continue;
          }

          // Update only verified quantities; do not touch financial amounts.
          // The surrounding transaction rolls back on any failed assertion.
          for (const update of quantityUpdates) {
            const result = await db.runAsync(`
              UPDATE entry_items
              SET quantity = ?
              WHERE id = ? AND ledger_entry_id = ?
                AND CAST(quantity AS REAL) = ?
            `,
              update.normalizedQuantity,
              update.id,
              update.ledgerEntryId,
              Number(update.originalQuantity)
            );

            if (result.changes !== 1) {
              throw new Error(`Quantity repair failed for item ${update.id}`);
            }
          }

          payload.items = repairedItems;
        }
      }

      if (!changed) continue;

      // Preserve original operation ID, entity ID, and FIFO position.
      const result = await db.runAsync(`
        UPDATE sync_outbox
        SET payload = ?, next_attempt_at = NULL, last_error = NULL
        WHERE id = ? AND payload = ?
      `, JSON.stringify(payload), row.id, row.payload);

      if (result.changes !== 1) {
        throw new Error(`Outbox repair failed for operation ${row.id}`);
      }

      repairedCount += 1;
      console.log('[sync-outbox] repaired', row.id, row.operation_type);
    }
  });

  return repairedCount;
}