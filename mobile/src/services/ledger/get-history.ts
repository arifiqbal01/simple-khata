
import { PartyRepository } from '@/repositories/party/party';

import {
  LedgerHistoryRepository,
  type LedgerHistoryEntry,
  type LedgerHistoryCursor,
  type LedgerHistoryFilter,
  type LedgerHistoryPage,
} from '@/repositories/ledger/ledger-history';

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
    private readonly ledgerHistoryRepository: LedgerHistoryRepository,
    private readonly partyRepository: PartyRepository
  ) {}

  /**
   * Verify that the Party belongs to this shop
   * and is an active CUSTOMER.
   */
  private async validateCustomer(
    shopId: string,
    customerId: string
  ): Promise<void> {
    if (!shopId.trim() || !customerId.trim()) {
      throw new Error(
        'Shop ID and customer ID are required'
      );
    }

    const customer =
      await this.partyRepository.getByIdAndShop(
        customerId,
        shopId
      );

    if (!customer || customer.type !== 'CUSTOMER') {
      throw new Error('Customer not found');
    }
  }

  /**
   * Offset-based history.
   *
   * Retained for existing screens using execute().
   */
  async execute(
    input: GetLedgerHistoryInput
  ): Promise<LedgerHistoryEntry[]> {
    const shopId = input.shopId.trim();
    const customerId = input.customerId.trim();

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
      shopId,
      customerId
    );

    return this.ledgerHistoryRepository.listByParty(
      shopId,
      customerId,
      limit,
      offset
    );
  }

  /**
   * Cursor-based history.
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
    const shopId = input.shopId.trim();
    const customerId = input.customerId.trim();

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
      shopId,
      customerId
    );

    return this.ledgerHistoryRepository.getHistoryPage(
      shopId,
      customerId,
      {
        limit,
        cursor: input.cursor ?? null,
        filter: input.filter,
      }
    );
  }
}
