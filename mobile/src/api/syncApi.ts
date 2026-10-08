import { env } from '@/config/env';

export type SyncEntityType =
  | 'CUSTOMER'
  | 'ITEM'
  | 'LEDGER_ENTRY';

export type SyncOperationType =
  | 'CUSTOMER_CREATE'
  | 'CUSTOMER_UPDATE'
  | 'ITEM_CREATE'
  | 'ITEM_UPDATE'
  | 'LEDGER_ENTRY_CREATE'
  | 'LEDGER_ENTRY_DELETE';


export interface LedgerEntryDeletePayload {
  entry: {
    id: string;
    deletedAt: string;
    deletedByDeviceId: string;
  };
}

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
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const message =
      await getErrorMessage(response);

    throw new Error(
      `Sync push failed (${response.status}): ${message}`
    );
  }

  return response.json();
}

/**
 * Pull remote changes after the local cursor.
 */
export async function pullSync(
  input: SyncPullInput
): Promise<SyncPullResponse> {
  const params =
    new URLSearchParams({
      shopId: input.shopId,
      deviceId: input.deviceId,
      cursor: String(input.cursor),
      limit: String(input.limit ?? 100),
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
    const message =
      await getErrorMessage(response);

    throw new Error(
      `Sync pull failed (${response.status}): ${message}`
    );
  }

  return response.json();
}

async function getErrorMessage(
  response: Response
): Promise<string> {
  try {
    const data: unknown =
      await response.json();

    if (
      data &&
      typeof data === 'object' &&
      'detail' in data
    ) {
      const detail = (
        data as {
          detail?: unknown;
        }
      ).detail;

      if (typeof detail === 'string') {
        return detail;
      }

      if (detail !== undefined) {
        return JSON.stringify(detail);
      }
    }

    if (
      data &&
      typeof data === 'object' &&
      'message' in data
    ) {
      const message = (
        data as {
          message?: unknown;
        }
      ).message;

      if (typeof message === 'string') {
        return message;
      }
    }
  } catch {
    // Ignore JSON parsing errors.
  }

  return (
    response.statusText ||
    'Unknown sync error'
  );
}