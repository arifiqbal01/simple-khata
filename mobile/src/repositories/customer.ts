
import { getDatabase } from '@/db/database';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Customer } from '@/types/domain';

export interface CreateCustomerValues {
  id: string;
  shopId: string;
  name: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerWithBalance {
  id: string;
  shop_id: string;
  name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;

  balance: number;
  last_activity_at: string | null;
}

export interface CustomerBalanceSummary {
  totalOutstanding: number;
  customers: CustomerWithBalance[];
}

export class CustomerRepository {
  async create(
    values: CreateCustomerValues
  ): Promise<Customer> {
    const db = await getDatabase();

    await this.createWithDatabase(db, values);

    const customer = await this.getById(values.id);

    if (!customer) {
      throw new Error(
        'Customer could not be loaded after creation'
      );
    }

    return customer;
  }

  async createWithDatabase(
    db: SQLiteDatabase,
    values: CreateCustomerValues
  ): Promise<void> {
    await db.runAsync(
      `
        INSERT INTO customers (
          id,
          shop_id,
          name,
          phone,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      values.id,
      values.shopId,
      values.name,
      values.phone,
      values.createdAt,
      values.updatedAt
    );
  }

  async getById(
    customerId: string
  ): Promise<Customer | null> {
    const db = await getDatabase();

    return db.getFirstAsync<Customer>(
      `
        SELECT
          id,
          shop_id,
          name,
          phone,
          created_at,
          updated_at
        FROM customers
        WHERE id = ?
        LIMIT 1
      `,
      customerId
    );
  }

  async getByIdAndShop(
    customerId: string,
    shopId: string
  ): Promise<Customer | null> {
    const db = await getDatabase();

    return db.getFirstAsync<Customer>(
      `
        SELECT
          id,
          shop_id,
          name,
          phone,
          created_at,
          updated_at
        FROM customers
        WHERE id = ?
          AND shop_id = ?
        LIMIT 1
      `,
      customerId,
      shopId
    );
  }

  async listByShop(
    shopId: string,
    limit = 100,
    offset = 0
  ): Promise<Customer[]> {
    const db = await getDatabase();

    return db.getAllAsync<Customer>(
      `
        SELECT
          id,
          shop_id,
          name,
          phone,
          created_at,
          updated_at
        FROM customers
        WHERE shop_id = ?
        ORDER BY name COLLATE NOCASE ASC, id ASC
        LIMIT ?
        OFFSET ?
      `,
      shopId,
      limit,
      offset
    );
  }

  async search(
    shopId: string,
    query: string,
    limit = 50,
    offset = 0
  ): Promise<Customer[]> {
    const db = await getDatabase();

    const pattern = `%${query}%`;

    return db.getAllAsync<Customer>(
      `
        SELECT
          id,
          shop_id,
          name,
          phone,
          created_at,
          updated_at
        FROM customers
        WHERE shop_id = ?
          AND (
            name LIKE ? COLLATE NOCASE
            OR phone LIKE ?
          )
        ORDER BY name COLLATE NOCASE ASC, id ASC
        LIMIT ?
        OFFSET ?
      `,
      shopId,
      pattern,
      pattern,
      limit,
      offset
    );
  }

  async getBalanceSummary(
    shopId: string,
    query = ''
  ): Promise<CustomerBalanceSummary> {
    const db = await getDatabase();

    const search = query.trim();

    const customers =
      await db.getAllAsync<CustomerWithBalance>(
        `
          SELECT
            c.id,
            c.shop_id,
            c.name,
            c.phone,
            c.created_at,
            c.updated_at,

            COALESCE(
              SUM(
                CASE
                  WHEN le.type = 'UDHAAR'
                    THEN le.amount
                  WHEN le.type = 'PAYMENT'
                    THEN -le.amount
                  ELSE 0
                END
              ),
              0
            ) AS balance,

            MAX(le.occurred_at) AS last_activity_at

          FROM customers c

          LEFT JOIN ledger_entries le
            ON le.customer_id = c.id
            AND le.deleted_at IS NULL

          WHERE
            c.shop_id = ?
            AND (
              ? = ''
              OR c.name LIKE '%' || ? || '%'
              OR COALESCE(c.phone, '') LIKE '%' || ? || '%'
            )

          GROUP BY
            c.id,
            c.shop_id,
            c.name,
            c.phone,
            c.created_at,
            c.updated_at

          ORDER BY
            CASE
              WHEN MAX(le.occurred_at) IS NULL THEN 1
              ELSE 0
            END,
            MAX(le.occurred_at) DESC,
            c.name COLLATE NOCASE ASC
        `,
        shopId,
        search,
        search,
        search
      );

    const totalOutstanding = customers.reduce(
      (total, customer) =>
        total + customer.balance,
      0
    );

    return {
      totalOutstanding,
      customers,
    };
  }
}
