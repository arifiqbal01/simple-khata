import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';
import type { Party, PartyType } from '@/types/domain';

export interface CreatePartyValues {
  id: string;
  shopId: string;
  type: PartyType;
  name: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePartyValues {
  id: string;
  shopId: string;
  name: string;
  phone: string | null;
  updatedAt: string;
}

export interface DeletePartyValues {
  id: string;
  shopId: string;
  deviceId: string;
  deletedAt: string;
}

export interface PartyWithBalance extends Party {
  balance: number;
  last_activity_at: string | null;
}

export interface PartyBalanceSummary {
  totalOutstanding: number;
  parties: PartyWithBalance[];
}

export interface PartyBalancePage extends PartyBalanceSummary {
  totalCount: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PartyPageOptions {
  query?: string;
  limit?: number;
  offset?: number;
}
export interface PartyFinancialTotals {
  toReceive: number;
  toPay: number;
  netBalance: number;
}

const PARTY_COLUMNS = `
  id,
  shop_id,
  type,
  name,
  phone,
  created_at,
  updated_at,
  deleted_at,
  deleted_by_device_id
`;

function validatePartyType(type: PartyType): void {
  if (type !== 'CUSTOMER' && type !== 'SUPPLIER') {
    throw new Error('Invalid party type');
  }
}

function normalizeName(name: string): string {
  const value = name.trim();
  if (!value) throw new Error('Party name is required');
  if (value.length > 150) {
    throw new Error('Party name cannot exceed 150 characters');
  }
  return value;
}

function normalizePhone(phone: string | null): string | null {
  const value = phone?.trim() || null;
  if (value && value.length > 30) {
    throw new Error('Party phone cannot exceed 30 characters');
  }
  return value;
}

function validatePage(limit: number, offset: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new Error('Page limit must be between 1 and 500');
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('Page offset must be a nonnegative integer');
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * SQLite party repository.
 * All ordinary reads exclude soft-deleted parties.
 * Transactional writes deliberately do not enqueue outbox operations;
 * callers must do so within their own database transaction.
 */
export class PartyRepository {
  async create(values: CreatePartyValues): Promise<Party> {
    const db = await getDatabase();
    await this.createWithDatabase(db, values);
    const party = await this.getByIdAndShop(values.id, values.shopId);
    if (!party) {
      throw new Error('Party could not be loaded after creation');
    }
    return party;
  }

  async createWithDatabase(
    db: SQLiteDatabase,
    values: CreatePartyValues
  ): Promise<void> {
    validatePartyType(values.type);
    const name = normalizeName(values.name);
    const phone = normalizePhone(values.phone);
    await db.runAsync(
      `INSERT INTO parties (
        id, shop_id, type, name, phone,
        created_at, updated_at, deleted_at, deleted_by_device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      values.id,
      values.shopId,
      values.type,
      name,
      phone,
      values.createdAt,
      values.updatedAt
    );
  }

  async updateWithDatabase(
    db: SQLiteDatabase,
    values: UpdatePartyValues
  ): Promise<boolean> {
    const name = normalizeName(values.name);
    const phone = normalizePhone(values.phone);
    const result = await db.runAsync(
      `UPDATE parties SET name = ?, phone = ?, updated_at = ?
       WHERE id = ? AND shop_id = ? AND deleted_at IS NULL`,
      name,
      phone,
      values.updatedAt,
      values.id,
      values.shopId
    );
    return result.changes > 0;
  }

  async softDeleteWithDatabase(
    db: SQLiteDatabase,
    values: DeletePartyValues
  ): Promise<boolean> {
    const result = await db.runAsync(
      `UPDATE parties
       SET deleted_at = ?, deleted_by_device_id = ?, updated_at = ?
       WHERE id = ? AND shop_id = ? AND deleted_at IS NULL`,
      values.deletedAt,
      values.deviceId,
      values.deletedAt,
      values.id,
      values.shopId
    );
    return result.changes > 0;
  }

  async getById(partyId: string): Promise<Party | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Party>(
      `SELECT ${PARTY_COLUMNS} FROM parties
       WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      partyId
    );
  }

  async getByIdAndShop(
    partyId: string,
    shopId: string
  ): Promise<Party | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Party>(
      `SELECT ${PARTY_COLUMNS} FROM parties
       WHERE id = ? AND shop_id = ? AND deleted_at IS NULL LIMIT 1`,
      partyId,
      shopId
    );
  }

  async getByIdIncludingDeleted(
    partyId: string,
    shopId: string
  ): Promise<Party | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Party>(
      `SELECT ${PARTY_COLUMNS} FROM parties
       WHERE id = ? AND shop_id = ? LIMIT 1`,
      partyId,
      shopId
    );
  }

  /** Lists lightweight party records in latest-activity order. */
  async listByShop(
    shopId: string,
    type: PartyType,
    limit = 100,
    offset = 0
  ): Promise<Party[]> {
    validatePartyType(type);
    validatePage(limit, offset);
    const db = await getDatabase();
    return db.getAllAsync<Party>(
      `SELECT ${PARTY_COLUMNS}
       FROM parties AS p
       WHERE p.shop_id = ? AND p.type = ? AND p.deleted_at IS NULL
       ORDER BY ${this.activityExpression('p')} DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      shopId,
      type,
      limit,
      offset
    );
  }

  /** Searches lightweight party records in latest-activity order. */
  async search(
    shopId: string,
    type: PartyType,
    query: string,
    limit = 50,
    offset = 0
  ): Promise<Party[]> {
    validatePartyType(type);
    validatePage(limit, offset);
    const db = await getDatabase();
    const pattern = `%${escapeLike(query.trim())}%`;
    return db.getAllAsync<Party>(
      `SELECT ${PARTY_COLUMNS}
       FROM parties AS p
       WHERE p.shop_id = ? AND p.type = ? AND p.deleted_at IS NULL
         AND (p.name LIKE ? ESCAPE '\\' COLLATE NOCASE
              OR COALESCE(p.phone, '') LIKE ? ESCAPE '\\')
       ORDER BY ${this.activityExpression('p')} DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      shopId,
      type,
      pattern,
      pattern,
      limit,
      offset
    );
  }

  /** Latest party creation or non-deleted ledger activity. */
  private activityExpression(partyAlias: string): string {
    return `MAX(
      ${partyAlias}.created_at,
      COALESCE(
        (SELECT MAX(le.occurred_at)
         FROM ledger_entries AS le
         WHERE le.party_id = ${partyAlias}.id
           AND le.deleted_at IS NULL),
        ${partyAlias}.created_at
      )
    )`;
  }

  private balanceSelectSql(): string {
    return `
      SELECT
        p.id, p.shop_id, p.type, p.name, p.phone,
        p.created_at, p.updated_at, p.deleted_at,
        p.deleted_by_device_id,
        COALESCE((
          SELECT SUM(CASE
            WHEN p.type = 'CUSTOMER' AND le.type = 'UDHAAR'
              THEN le.amount
            WHEN p.type = 'SUPPLIER' AND le.type = 'SUPPLY'
              THEN le.amount
            WHEN le.type = 'PAYMENT'
              THEN -le.amount
            ELSE 0
          END)
          FROM ledger_entries AS le
          WHERE le.party_id = p.id
            AND le.deleted_at IS NULL
        ), 0) AS balance,
        ${this.activityExpression('p')} AS last_activity_at
      FROM parties AS p
    `;
  }

  /**
   * Legacy unpaged API retained for existing callers.
   * Prefer getBalancePage() for home and list screens.
   */
  async getBalanceSummary(
    shopId: string,
    type: PartyType,
    query = ''
  ): Promise<PartyBalanceSummary> {
    validatePartyType(type);
    const db = await getDatabase();
    const pattern = `%${escapeLike(query.trim())}%`;
    const parties = await db.getAllAsync<PartyWithBalance>(
      `${this.balanceSelectSql()}
       WHERE p.shop_id = ? AND p.type = ? AND p.deleted_at IS NULL
         AND (p.name LIKE ? ESCAPE '\\' COLLATE NOCASE
              OR COALESCE(p.phone, '') LIKE ? ESCAPE '\\')
       ORDER BY last_activity_at DESC, p.id DESC`,
      shopId,
      type,
      pattern,
      pattern
    );
    return {
      totalOutstanding: parties.reduce(
        (total, party) => total + party.balance,
        0
      ),
      parties,
    };
  }



/**
 * All-party financial totals.
 * Independent of search and pagination.
 * Read-only: does not modify ledger or sync data.
 */
async getFinancialTotals(
  shopId: string,
  type: PartyType
): Promise<PartyFinancialTotals> {
  validatePartyType(type);

  const db = await getDatabase();

  const result = await db.getFirstAsync<{
    to_receive: number;
    to_pay: number;
  }>(
    `SELECT
       COALESCE(SUM(
         CASE WHEN balances.balance < 0
           THEN -balances.balance ELSE 0 END
       ), 0) AS to_receive,
       COALESCE(SUM(
         CASE WHEN balances.balance > 0
           THEN balances.balance ELSE 0 END
       ), 0) AS to_pay
     FROM (
       SELECT
         p.id,
         COALESCE(SUM(
           CASE
             WHEN p.type = 'CUSTOMER'
               AND le.type = 'UDHAAR'
               THEN le.amount
             WHEN p.type = 'SUPPLIER'
               AND le.type = 'SUPPLY'
               THEN le.amount
             WHEN le.type = 'PAYMENT'
               THEN -le.amount
             ELSE 0
           END
         ), 0) AS balance
       FROM parties AS p
       LEFT JOIN ledger_entries AS le
         ON le.party_id = p.id
         AND le.deleted_at IS NULL
       WHERE p.shop_id = ?
         AND p.type = ?
         AND p.deleted_at IS NULL
       GROUP BY p.id
     ) AS balances`,
    shopId,
    type
  );

  const toReceive = result?.to_receive ?? 0;
  const toPay = result?.to_pay ?? 0;

  return {
    toReceive,
    toPay,
    netBalance: toReceive - toPay,
  };
}


  /**
   * Fetches one page of party balances, plus an all-matches total.
   * The total is not limited to the returned page.
   */
  async getBalancePage(
    shopId: string,
    type: PartyType,
    options: PartyPageOptions = {}
  ): Promise<PartyBalancePage> {
    validatePartyType(type);
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    validatePage(limit, offset);
    const pattern = `%${escapeLike((options.query ?? '').trim())}%`;
    const db = await getDatabase();

    const where = `
      WHERE p.shop_id = ? AND p.type = ? AND p.deleted_at IS NULL
        AND (p.name LIKE ? ESCAPE '\\' COLLATE NOCASE
             OR COALESCE(p.phone, '') LIKE ? ESCAPE '\\')
    `;
    const args = [shopId, type, pattern, pattern] as const;

    const parties = await db.getAllAsync<PartyWithBalance>(
      `${this.balanceSelectSql()}
       ${where}
       ORDER BY last_activity_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      ...args,
      limit,
      offset
    );

    const aggregate = await db.getFirstAsync<{
      total_count: number;
      total_outstanding: number;
    }>(
      `SELECT COUNT(*) AS total_count,
              COALESCE(SUM(
                COALESCE((
                  SELECT SUM(CASE
                    WHEN p.type = 'CUSTOMER' AND le.type = 'UDHAAR'
                      THEN le.amount
                    WHEN p.type = 'SUPPLIER' AND le.type = 'SUPPLY'
                      THEN le.amount
                    WHEN le.type = 'PAYMENT'
                      THEN -le.amount
                    ELSE 0
                  END)
                  FROM ledger_entries AS le
                  WHERE le.party_id = p.id
                     AND le.deleted_at IS NULL
                ), 0)
              ), 0) AS total_outstanding
       FROM parties AS p
       ${where}`,
      ...args
    );

    const totalCount = aggregate?.total_count ?? 0;
    return {
      parties,
      totalOutstanding: aggregate?.total_outstanding ?? 0,
      totalCount,
      limit,
      offset,
      hasMore: offset + parties.length < totalCount,
    };
  }

}
