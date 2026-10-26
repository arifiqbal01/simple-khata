
import { getDatabase } from '@/db/database';
import type { PartyType } from '@/types/domain';

export interface ShopLedgerSummary {
  totalMoneyOut: number;
  totalMoneyIn: number;
}

export interface CustomerLedgerSummary {
  totalUdhaar: number;
  totalPayments: number;
  outstanding: number;
}

export interface SupplierLedgerSummary {
  totalSupply: number;
  totalPayments: number;
  outstanding: number;
}

export interface PartyLedgerSummary {
  totalCharges: number;
  totalPayments: number;
  outstanding: number;
}

interface PartySummaryRow {
  total_charges: number;
  total_payments: number;
  outstanding: number;
}

interface BalanceRow {
  balance: number;
}

interface ShopSummaryRow {
  total_money_out: number;
  total_money_in: number;
}

export class LedgerSummaryRepository {
  async getPartyLedgerSummary(
    shopId: string,
    partyId: string,
    type: PartyType
  ): Promise<PartyLedgerSummary> {
    if (
      type !== 'CUSTOMER' &&
      type !== 'SUPPLIER'
    ) {
      throw new Error('Invalid Party type');
    }

    const db = await getDatabase();

    const chargeType =
      type === 'CUSTOMER' ? 'UDHAAR' : 'SUPPLY';

    const row = await db.getFirstAsync<PartySummaryRow>(
      `
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN le.type = ? THEN le.amount
                ELSE 0
              END
            ),
            0
          ) AS total_charges,

          COALESCE(
            SUM(
              CASE
                WHEN le.type = 'PAYMENT'
                  THEN le.amount
                ELSE 0
              END
            ),
            0
          ) AS total_payments,

          COALESCE(
            SUM(
              CASE
                WHEN le.type = ?
                  THEN le.amount
                WHEN le.type = 'PAYMENT'
                  THEN -le.amount
                ELSE 0
              END
            ),
            0
          ) AS outstanding

        FROM ledger_entries AS le

        INNER JOIN parties AS p
          ON p.id = le.party_id

        WHERE le.party_id = ?
          AND p.shop_id = ?
          AND p.type = ?
          AND le.deleted_at IS NULL
      `,
      chargeType,
      chargeType,
      partyId,
      shopId,
      type
    );

    return {
      totalCharges: row?.total_charges ?? 0,
      totalPayments: row?.total_payments ?? 0,
      outstanding: row?.outstanding ?? 0,
    };
  }

  async getPartyBalance(
    shopId: string,
    partyId: string,
    type: PartyType
  ): Promise<number> {
    const summary = await this.getPartyLedgerSummary(
      shopId,
      partyId,
      type
    );

    return summary.outstanding;
  }

  async getCustomerLedgerSummary(
    shopId: string,
    customerId: string
  ): Promise<CustomerLedgerSummary> {
    const summary = await this.getPartyLedgerSummary(
      shopId,
      customerId,
      'CUSTOMER'
    );

    return {
      totalUdhaar: summary.totalCharges,
      totalPayments: summary.totalPayments,
      outstanding: summary.outstanding,
    };
  }

  async getSupplierLedgerSummary(
    shopId: string,
    supplierId: string
  ): Promise<SupplierLedgerSummary> {
    const summary = await this.getPartyLedgerSummary(
      shopId,
      supplierId,
      'SUPPLIER'
    );

    return {
      totalSupply: summary.totalCharges,
      totalPayments: summary.totalPayments,
      outstanding: summary.outstanding,
    };
  }

  async getCustomerBalance(
    shopId: string,
    customerId: string
  ): Promise<number> {
    return this.getPartyBalance(
      shopId,
      customerId,
      'CUSTOMER'
    );
  }

  async getSupplierBalance(
    shopId: string,
    supplierId: string
  ): Promise<number> {
    return this.getPartyBalance(
      shopId,
      supplierId,
      'SUPPLIER'
    );
  }

  /**
   * Preserves the original customer-only dashboard
   * meaning:
   *
   * totalMoneyOut = customer UDHAAR
   * totalMoneyIn  = customer PAYMENT
   *
   * Supplier transactions are intentionally excluded.
   */
  async getShopLedgerSummary(
    shopId: string
  ): Promise<ShopLedgerSummary> {
    const db = await getDatabase();

    const row = await db.getFirstAsync<ShopSummaryRow>(
      `
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN le.type = 'UDHAAR'
                  THEN le.amount
                ELSE 0
              END
            ),
            0
          ) AS total_money_out,

          COALESCE(
            SUM(
              CASE
                WHEN le.type = 'PAYMENT'
                  THEN le.amount
                ELSE 0
              END
            ),
            0
          ) AS total_money_in

        FROM ledger_entries AS le

        INNER JOIN parties AS p
          ON p.id = le.party_id

        WHERE p.shop_id = ?
          AND p.type = 'CUSTOMER'
          AND le.deleted_at IS NULL
      `,
      shopId
    );

    return {
      totalMoneyOut: row?.total_money_out ?? 0,
      totalMoneyIn: row?.total_money_in ?? 0,
    };
  }
}