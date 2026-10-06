import { CustomerRepository } from '@/repositories/customer';
import { LedgerRepository } from '@/repositories/ledger';

export interface GetCustomerBalanceInput {
  shopId: string;
  customerId: string;
}

export class GetCustomerBalanceService {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly customerRepository: CustomerRepository
  ) {}

  async execute(
    input: GetCustomerBalanceInput
  ): Promise<number> {
    const customer = await this.customerRepository.getByIdAndShop(
      input.customerId,
      input.shopId
    );

    if (!customer) {
      throw new Error('Customer not found');
    }

    return this.ledgerRepository.getCustomerBalance(
      input.shopId,
      input.customerId
    );
  }
}