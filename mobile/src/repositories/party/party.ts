
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

  if (!value) {
    throw new Error('Party name is required');
  }

  if (value.length > 150) {
    throw new Error(
      'Party name cannot exceed 150 characters'
    );
  }

  return value;
}

function normalizePhone(
  phone: string | null
): string | null {
  const value = phone?.trim() || null;

  if (value && value.length > 30) {
    throw new Error(
      'Party phone cannot exceed 30 characters'
    );
  }

  return value;
}

/**
 * SQLite v6 Party repository.
 *
 * Customers and suppliers share the parties table.
 *
 * All normal reads exclude soft-deleted parties.
 *
 * Methods accepting a SQLiteDatabase can be called
 * inside an existing transaction together with
 * sync_outboxRepository.enqueueWithDatabase().
 *
 * This repository does not enqueue sync operations.
 */
export class PartyRepository {
  async create(
    values: CreatePartyValues
  ): Promise<Party> {
    const db = await getDatabase();

    await this.createWithDatabase(db, values);

    const party = await this.getByIdAndShop(
      values.id,
      values.shopId
    );

    if (!party) {
      throw new Error(
        'Party could not be loaded after creation'
      );
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
      `
        INSERT INTO parties (
          id,
          shop_id,
          type,
          name,
          phone,
          created_at,
          updated_at,
          deleted_at,
          deleted_by_device_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
      `,
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
      `
        UPDATE parties
        SET
          name = ?,
          phone = ?,
          updated_at = ?
        WHERE id = ?
          AND shop_id = ?
          AND deleted_at IS NULL
      `,
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
      `
        UPDATE parties
        SET
          deleted_at = ?,
          deleted_by_device_id = ?,
          updated_at = ?
        WHERE id = ?
          AND shop_id = ?
          AND deleted_at IS NULL
      `,
      values.deletedAt,
      values.deviceId,
      values.deletedAt,
      values.id,
      values.shopId
    );

    return result.changes > 0;
  }

  async getById(
    partyId: string
  ): Promise<Party | null> {
    const db = await getDatabase();

    return db.getFirstAsync<Party>(
      `
        SELECT ${PARTY_COLUMNS}
        FROM parties
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      partyId
    );
  }

  async getByIdAndShop(
    partyId: string,
    shopId: string
  ): Promise<Party | null> {
    const db = await getDatabase();

    return db.getFirstAsync<Party>(
      `
        SELECT ${PARTY_COLUMNS}
        FROM parties
        WHERE id = ?
          AND shop_id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
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
      `
        SELECT ${PARTY_COLUMNS}
        FROM parties
        WHERE id = ?
          AND shop_id = ?
        LIMIT 1
      `,
      partyId,
      shopId
    );
  }

  async listByShop(
    shopId: string,
    type: PartyType,
    limit = 100,
    offset = 0
  ): Promise<Party[]> {
    validatePartyType(type);

    const db = await getDatabase();

    return db.getAllAsync<Party>(
      `
        SELECT ${PARTY_COLUMNS}
        FROM parties
        WHERE shop_id = ?
          AND type = ?
          AND deleted_at IS NULL
        ORDER BY
          name COLLATE NOCASE ASC,
          id ASC
        LIMIT ?
        OFFSET ?
      `,
      shopId,
      type,
      limit,
      offset
    );
  }

  async search(
    shopId: string,
    type: PartyType,
    query: string,
    limit = 50,
    offset = 0
  ): Promise<Party[]> {
    validatePartyType(type);

    const db = await getDatabase();
    const pattern = `%${query.trim()}%`;

    return db.getAllAsync<Party>(
      `
        SELECT ${PARTY_COLUMNS}
        FROM parties
        WHERE shop_id = ?
          AND type = ?
          AND deleted_at IS NULL
          AND (
            name LIKE ? COLLATE NOCASE
            OR COALESCE(phone, '') LIKE ?
          )
        ORDER BY
          name COLLATE NOCASE ASC,
          id ASC
        LIMIT ?
        OFFSET ?
      `,
      shopId,
      type,
      pattern,
      pattern,
      limit,
      offset
    );
  }

  /**
   * Returns customer or supplier balances.
   *
   * Customer:
   *   UDHAAR - PAYMENT
   *
   * Supplier:
   *   SUPPLY - PAYMENT
   *
   * A positive supplier balance represents
   * an amount payable to the supplier.
   */
  async getBalanceSummary(
    shopId: string,
    type: PartyType,
    query = ''
  ): Promise<PartyBalanceSummary> {
    validatePartyType(type);

    const db = await getDatabase();
    const search = query.trim();

    const parties =
      await db.getAllAsync<PartyWithBalance>(
        `
          SELECT
            p.id,
            p.shop_id,
            p.type,
            p.name,
            p.phone,
            p.created_at,
            p.updated_at,
            p.deleted_at,
            p.deleted_by_device_id,

            COALESCE(
              SUM(
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
              ),
              0
            ) AS balance,

            MAX(le.occurred_at) AS last_activity_at

          FROM parties AS p

          LEFT JOIN ledger_entries AS le
            ON le.party_id = p.id
            AND le.deleted_at IS NULL

          WHERE
            p.shop_id = ?
            AND p.type = ?
            AND p.deleted_at IS NULL
            AND (
              ? = ''
              OR p.name LIKE '%' || ? || '%'
              OR COALESCE(p.phone, '') LIKE '%' || ? || '%'
            )

          GROUP BY
            p.id,
            p.shop_id,
            p.type,
            p.name,
            p.phone,
            p.created_at,
            p.updated_at,
            p.deleted_at,
            p.deleted_by_device_id

          ORDER BY
            CASE
              WHEN MAX(le.occurred_at) IS NULL THEN 1
              ELSE 0
            END,
            MAX(le.occurred_at) DESC,
            p.name COLLATE NOCASE ASC,
            p.id ASC
        `,
        shopId,
        type,
        search,
        search,
        search
      );

    const totalOutstanding = parties.reduce(
      (total, party) => total + party.balance,
      0
    );

    return {
      totalOutstanding,
      parties,
    };
  }
}