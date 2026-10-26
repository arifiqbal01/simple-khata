
import { PartyRepository } from '@/repositories/party/party';
import { LedgerSummaryRepository } from '@/repositories/ledger/ledger-summary';

export interface GetCustomerBalanceInput {
  shopId: string;
  customerId: string;
}

export class GetCustomerBalanceService {
  constructor(
    private readonly ledgerSummaryRepository: LedgerSummaryRepository,
    private readonly partyRepository: PartyRepository
  ) {}

  async execute(
    input: GetCustomerBalanceInput
  ): Promise<number> {
    const shopId = input.shopId.trim();
    const customerId = input.customerId.trim();

    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const customer =
      await this.partyRepository.getByIdAndShop(
        customerId,
        shopId
      );

    if (!customer || customer.type !== 'CUSTOMER') {
      throw new Error('Customer not found');
    }

    return this.ledgerSummaryRepository.getCustomerBalance(
      shopId,
      customerId
    );
  }
}
