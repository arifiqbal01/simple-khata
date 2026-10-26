
import { env } from '@/config/env';

/**
 * Sync entities supported by the v6 protocol.
 *
 * CUSTOMER remains for compatibility with
 * operations created before the v6 migration.
 */
export type SyncEntityType =
  | 'CUSTOMER'
  | 'PARTY'
  | 'ITEM'
  | 'SUPPLIER_ITEM'
  | 'LEDGER_ENTRY';

/**
 * Supported sync operation types.
 *
 * Legacy CUSTOMER_* operations must remain
 * readable until all pending operations
 * from older installations are processed.
 */
export type SyncOperationType =
  | 'CUSTOMER_CREATE'
  | 'CUSTOMER_UPDATE'
  | 'PARTY_CREATE'
  | 'PARTY_UPDATE'
  | 'PARTY_DELETE'
  | 'ITEM_CREATE'
  | 'ITEM_UPDATE'
  | 'ITEM_DELETE'
  | 'SUPPLIER_ITEM_CREATE'
  | 'SUPPLIER_ITEM_UPDATE'
  | 'SUPPLIER_ITEM_DELETE'
  | 'LEDGER_ENTRY_CREATE'
  | 'LEDGER_ENTRY_DELETE';

export type SyncPartyType =
  | 'CUSTOMER'
  | 'SUPPLIER';

export type SyncLedgerEntryType =
  | 'UDHAAR'
  | 'SUPPLY'
  | 'PAYMENT';

/**
 * Party creation/update payload.
 */
export interface PartySyncPayload {
  party: {
    id: string;
    shopId: string;
    type: SyncPartyType;
    name: string;
    phone: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * Party soft-deletion payload.
 *
 * Matches the DeletePartyService outbox format.
 */
export interface PartyDeletePayload {
  partyId: string;
  shopId: string;
  deletedAt: string;
  deletedByDeviceId: string;
}

/**
 * Item creation/update payload.
 */
export interface ItemSyncPayload {
  item: {
    id: string;
    shopId: string;
    name: string;
    createdAt: string;
    updatedAt?: string;
    defaultUnit?: string | null;
    defaultSellingPrice?: number | null;
  };
}

/**
 * Item soft-deletion payload.
 *
 * This shape must match the local item
 * deletion service and backend contract.
 */
export interface ItemDeletePayload {
  itemId: string;
  shopId: string;
  deletedAt: string;
  deletedByDeviceId: string;
}

export interface SupplierItemSyncPayload {
  supplierItem: {
    id: string;
    shopId: string;
    supplierId: string;
    itemId: string;
    unit: string;
    unitPrice: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface SupplierItemDeletePayload {
  supplierItem: {
    id: string;
    shopId: string;
    supplierId: string;
    itemId: string;
  };
}

/**
 * Snapshot of an item attached to a ledger entry.
 */
export interface LedgerEntryItemSyncPayload {
  id: string;
  ledgerEntryId: string;
  itemId: string | null;
  itemName: string;
  amount?: number | null;
  quantity?: string | null;
  unit?: string | null;
  unitPrice?: number | null;
  createdAt: string;
}

/**
 * Ledger entry creation payload.
 *
 * partyId is the v6 field.
 * customerId remains optional for legacy
 * operations already queued before migration.
 */
export interface LedgerEntrySyncPayload {
  entry: {
    id: string;
    partyId?: string;
    customerId?: string;
    deviceId: string;
    type: SyncLedgerEntryType;
    amount: number;
    note: string | null;
    occurredAt: string;
    createdAt: string;
  };

  items: LedgerEntryItemSyncPayload[];
}

/**
 * Ledger entry soft-deletion payload.
 */
export interface LedgerEntryDeletePayload {
  entry: {
    id: string;
    deletedAt: string;
    deletedByDeviceId: string;
  };
}

/**
 * A locally queued operation sent to the backend.
 *
 * payload is intentionally unknown because
 * existing outbox records can contain legacy
 * operation-specific payload formats.
 */
export interface SyncPushOperation {
  id: string;
  operationType: SyncOperationType;
  entityType: SyncEntityType;
  entityId: string;
  createdAt: string;
  payload: unknown;
}

export interface SyncPushRequest {
  shopId: string;
  deviceId: string;
  operations: SyncPushOperation[];
}

export interface SyncPushResponse {
  acknowledgedOperationIds: string[];
}

/**
 * One remote change returned by the server.
 */
export interface SyncChange {
  sequence: number;
  entityType: SyncEntityType;
  entityId: string;
  operationType: SyncOperationType;
  payload: unknown;
  createdAt: string;
}

export interface SyncPullResponse {
  changes: SyncChange[];
  nextCursor: number;
  hasMore: boolean;
}

export interface SyncPullInput {
  shopId: string;
  deviceId: string;
  cursor: number;
  limit?: number;
}

/**
 * Push locally queued operations to the backend.
 *
 * The server must implement idempotent processing
 * based on each operation's stable ID.
 */
export async function pushSync(
  data: SyncPushRequest
): Promise<SyncPushResponse> {
  const response = await fetch(
    `${env.apiUrl}/sync/push`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const message = await getErrorMessage(response);

    throw new Error(
      `Sync push failed (${response.status}): ${message}`
    );
  }

  const result: unknown = await response.json();

  if (
    !isRecord(result) ||
    !Array.isArray(result.acknowledgedOperationIds) ||
    !result.acknowledgedOperationIds.every(
      (id) => typeof id === 'string'
    )
  ) {
    throw new Error('Invalid sync push response');
  }

  return {
    acknowledgedOperationIds:
      result.acknowledgedOperationIds as string[],
  };
}

/**
 * Pull remote changes after the local cursor.
 *
 * The caller must apply changes and advance
 * its SQLite cursor in the same transaction.
 */
export async function pullSync(
  input: SyncPullInput
): Promise<SyncPullResponse> {
  if (
    !Number.isSafeInteger(input.cursor) ||
    input.cursor < 0
  ) {
    throw new Error('Invalid sync pull cursor');
  }

  const limit = input.limit ?? 100;

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error(
      'Sync pull limit must be between 1 and 100'
    );
  }

  const params = new URLSearchParams({
    shopId: input.shopId,
    deviceId: input.deviceId,
    cursor: String(input.cursor),
    limit: String(limit),
  });

  const response = await fetch(
    `${env.apiUrl}/sync/pull?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    const message = await getErrorMessage(response);

    throw new Error(
      `Sync pull failed (${response.status}): ${message}`
    );
  }

  const result: unknown = await response.json();

  if (
    !isRecord(result) ||
    !Array.isArray(result.changes) ||
    !Number.isSafeInteger(result.nextCursor) ||
    typeof result.hasMore !== 'boolean'
  ) {
    throw new Error('Invalid sync pull response');
  }

  for (const change of result.changes) {
    if (!isValidSyncChange(change)) {
      throw new Error(
        'Invalid sync change received from server'
      );
    }
  }

  return {
    changes: result.changes as SyncChange[],
    nextCursor: result.nextCursor as number,
    hasMore: result.hasMore as boolean,
  };
}

/**
 * Validate the envelope of a remote change.
 *
 * Detailed payload validation belongs to
 * the corresponding pull apply handler.
 */
function isValidSyncChange(
  value: unknown
): value is SyncChange {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isSafeInteger(value.sequence) &&
    (value.sequence as number) >= 0 &&
    typeof value.entityType === 'string' &&
    typeof value.entityId === 'string' &&
    typeof value.operationType === 'string' &&
    typeof value.createdAt === 'string' &&
    'payload' in value
  );
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

/**
 * Extract a useful error message from
 * FastAPI or another JSON HTTP backend.
 */
async function getErrorMessage(
  response: Response
): Promise<string> {
  try {
    const data: unknown = await response.json();

    if (isRecord(data)) {
      const detail = data.detail;

      if (typeof detail === 'string') {
        return detail;
      }

      if (detail !== undefined) {
        return JSON.stringify(detail);
      }

      if (typeof data.message === 'string') {
        return data.message;
      }
    }
  } catch {
    // Ignore malformed or non-JSON error bodies.
  }

  return (
    response.statusText ||
    'Unknown sync error'
  );
}
