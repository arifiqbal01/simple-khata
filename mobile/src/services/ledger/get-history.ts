
import { CustomerRepository } from '@/repositories/customer';

import {
  LedgerRepository,
  type LedgerHistoryEntry,
  type LedgerHistoryCursor,
  type LedgerHistoryFilter,
  type LedgerHistoryPage,
} from '@/repositories/ledger';

export interface GetLedgerHistoryInput {
  shopId: string;
  customerId: string;
  limit?: number;
  offset?: number;
}

export interface GetLedgerHistoryPageInput {
  shopId: string;
  customerId: string;
  limit?: number;
  cursor?: LedgerHistoryCursor | null;
  filter?: LedgerHistoryFilter;
}

export class GetLedgerHistoryService {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly customerRepository: CustomerRepository
  ) {}

  /**
   * Verify that the customer belongs to the shop.
   */
  private async validateCustomer(
    shopId: string,
    customerId: string
  ): Promise<void> {
    if (!shopId || !customerId) {
      throw new Error(
        'Shop ID and customer ID are required'
      );
    }

    const customer =
      await this.customerRepository.getByIdAndShop(
        customerId,
        shopId
      );

    if (!customer) {
      throw new Error('Customer not found');
    }
  }

  /**
   * Existing offset-based history method.
   *
   * Kept for backward compatibility with
   * screens that still use execute().
   */
  async execute(
    input: GetLedgerHistoryInput
  ): Promise<LedgerHistoryEntry[]> {
    const limit = input.limit ?? 100;
    const offset = input.offset ?? 0;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new Error(
        'Limit must be between 1 and 100'
      );
    }

    if (
      !Number.isInteger(offset) ||
      offset < 0
    ) {
      throw new Error(
        'Offset must be a non-negative integer'
      );
    }

    await this.validateCustomer(
      input.shopId,
      input.customerId
    );

    return this.ledgerRepository.listByCustomer(
      input.shopId,
      input.customerId,
      limit,
      offset
    );
  }

  /**
   * New cursor-based history method.
   *
   * Supports:
   * - Infinite scrolling
   * - Date filtering
   * - Historical running balances
   * - Offline-first SQLite queries
   */
  async executePage(
    input: GetLedgerHistoryPageInput
  ): Promise<LedgerHistoryPage> {
    const limit = input.limit ?? 30;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new Error(
        'Limit must be between 1 and 100'
      );
    }

    if (
      input.filter?.from &&
      !Number.isFinite(
        Date.parse(input.filter.from)
      )
    ) {
      throw new Error('Invalid start date');
    }

    if (
      input.filter?.to &&
      !Number.isFinite(
        Date.parse(input.filter.to)
      )
    ) {
      throw new Error('Invalid end date');
    }

    if (
      input.filter?.from &&
      input.filter?.to &&
      Date.parse(input.filter.from) >=
        Date.parse(input.filter.to)
    ) {
      throw new Error(
        'Start date must be before end date'
      );
    }

    await this.validateCustomer(
      input.shopId,
      input.customerId
    );

    return this.ledgerRepository.getHistoryPage(
      input.shopId,
      input.customerId,
      {
        limit,
        cursor: input.cursor ?? null,
        filter: input.filter,
      }
    );
  }
}
