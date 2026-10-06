import { CustomerRepository } from '@/repositories/customer';
import {
  LedgerRepository,
  type LedgerHistoryEntry,
} from '@/repositories/ledger';

export interface GetLedgerHistoryInput {
  shopId: string;
  customerId: string;
  limit?: number;
  offset?: number;
}

export class GetLedgerHistoryService {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly customerRepository: CustomerRepository
  ) {}

  async execute(
    input: GetLedgerHistoryInput
  ): Promise<LedgerHistoryEntry[]> {
    const limit = input.limit ?? 100;
    const offset = input.offset ?? 0;

    if (limit < 1 || limit > 100) {
      throw new Error(
        'Limit must be between 1 and 100'
      );
    }

    if (offset < 0) {
      throw new Error(
        'Offset cannot be negative'
      );
    }

    const customer =
      await this.customerRepository.getByIdAndShop(
        input.customerId,
        input.shopId
      );

    if (!customer) {
      throw new Error('Customer not found');
    }

    return this.ledgerRepository.listByCustomer(
      input.shopId,
      input.customerId,
      limit,
      offset
    );
  }
}