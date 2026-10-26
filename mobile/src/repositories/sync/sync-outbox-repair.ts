import { getDatabase } from '@/db/database';
import { runWriteTransaction } from '@/db/write-transaction';
import type { SyncOperationType } from './sync-outbox';

export async function repairLegacyOutboxPayloads(): Promise<number> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    id: string;
    operation_type: SyncOperationType;
    payload: string;
  }>(
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
      ORDER BY created_at ASC
    `,
  );

  let repairedCount = 0;

  await runWriteTransaction(async (db) => {
    for (const row of rows) {
      let payload: any;

      try {
        payload = JSON.parse(row.payload);
      } catch {
        console.warn(
          '[sync-outbox] invalid JSON payload',
          row.id,
        );
        continue;
      }

      let changed = false;

      /*
       * Repair customer payload from domain snake_case
       * to the camelCase sync API contract.
       */
      if (
        (row.operation_type === 'CUSTOMER_CREATE' ||
          row.operation_type === 'CUSTOMER_UPDATE') &&
        payload?.customer
      ) {
        const customer = payload.customer;

        if (
          customer.shop_id ||
          customer.created_at ||
          customer.updated_at
        ) {
          payload.customer = {
            id: customer.id,
            shopId: customer.shopId ?? customer.shop_id,
            name: customer.name,
            phone: customer.phone ?? null,
            createdAt:
              customer.createdAt ?? customer.created_at,
            updatedAt:
              customer.updatedAt ?? customer.updated_at,
          };

          changed = true;
        }
      }

      /*
       * Repair item payload and ensure updatedAt exists.
       */
      if (
        (row.operation_type === 'ITEM_CREATE' ||
          row.operation_type === 'ITEM_UPDATE') &&
        payload?.item
      ) {
        const item = payload.item;

        if (
          item.shop_id ||
          item.created_at ||
          !item.updatedAt
        ) {
          const createdAt =
            item.createdAt ?? item.created_at;

          payload.item = {
            id: item.id,
            shopId: item.shopId ?? item.shop_id,
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
       * Repair ledger entry and entry-item payloads.
       */
      if (
        row.operation_type === 'LEDGER_ENTRY_CREATE' &&
        payload?.entry
      ) {
        const entry = payload.entry;

        if (
          entry.customer_id ||
          entry.device_id ||
          entry.occurred_at ||
          entry.created_at
        ) {
          payload.entry = {
              ...entry,

              partyId:
                entry.partyId ??
                entry.party_id ??
                entry.customerId ??
                entry.customer_id,

              deviceId:
                entry.deviceId ?? entry.device_id,

              type: entry.type,
              amount: entry.amount,
              note: entry.note ?? null,

              occurredAt:
                entry.occurredAt ?? entry.occurred_at,

              createdAt:
                entry.createdAt ?? entry.created_at,
            };

            delete payload.entry.party_id;
            delete payload.entry.customer_id;
            delete payload.entry.device_id;
            delete payload.entry.occurred_at;
            delete payload.entry.created_at;

          changed = true;
        }

        if (Array.isArray(payload.items)) {
          payload.items = payload.items.map(
            (item: any) => {
              const repairedItem = {
                ...item,
              };

              if (!repairedItem.ledgerEntryId) {
                repairedItem.ledgerEntryId =
                  payload.entry.id;
                changed = true;
              }

              if (
                !repairedItem.itemName &&
                repairedItem.name
              ) {
                repairedItem.itemName =
                  repairedItem.name;
                changed = true;
              }

              if (!repairedItem.createdAt) {
                repairedItem.createdAt =
                  payload.entry.createdAt;
                changed = true;
              }

              if ('name' in repairedItem) {
                delete repairedItem.name;
                changed = true;
              }

              return repairedItem;
            },
          );
        }
      }

      if (!changed) {
        continue;
      }

      await db.runAsync(
        `
          UPDATE sync_outbox
          SET
            payload = ?,
            next_attempt_at = NULL,
            last_error = NULL
          WHERE id = ?
        `,
        JSON.stringify(payload),
        row.id,
      );

      repairedCount += 1;

      console.log(
        '[sync-outbox] repaired',
        row.id,
        row.operation_type,
      );
    }
  });

  return repairedCount;
}