
import type {
  SyncOutboxRecord,
} from '@/repositories/sync/sync-outbox';

import type {
  SyncPushOperation,
} from '@/api/syncApi';

/**
 * Convert an outbox record into the API
 * operation format without changing its ID,
 * type, timestamp, or payload contents.
 */
export function toPushOperation(
  record: SyncOutboxRecord
): SyncPushOperation {
  let payload: unknown;

  try {
    payload = JSON.parse(record.payload);
  } catch {
    throw new Error(
      `Invalid sync payload for operation ${record.id}`
    );
  }

  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw new Error(
      `Sync payload must be an object: ${record.id}`
    );
  }

  return {
    id: record.id,
    operationType: record.operationType,
    entityType: record.entityType,
    entityId: record.entityId,
    createdAt: record.createdAt,
    payload,
  };
}

/**
 * Verify every acknowledgement belongs to
 * an operation actually included in this batch.
 *
 * Duplicate acknowledgements are rejected.
 */
export function validateAcknowledgements(
  batch: SyncOutboxRecord[],
  acknowledgedIds: string[]
): void {
  const sentIds = new Set(
    batch.map((operation) => operation.id)
  );

  const seenIds = new Set<string>();

  for (const id of acknowledgedIds) {
    if (!sentIds.has(id)) {
      throw new Error(
        `Server acknowledged unknown sync operation ${id}`
      );
    }

    if (seenIds.has(id)) {
      throw new Error(
        `Server acknowledged operation more than once: ${id}`
      );
    }

    seenIds.add(id);
  }
}

/**
 * Produce a readable error message for
 * retry metadata and diagnostic logs.
 */
export function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
