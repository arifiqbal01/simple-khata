import { CustomerRepository } from '@/repositories/customer';
import type { Customer } from '@/types/domain';

export interface SearchCustomersInput {
  shopId: string;
  query?: string | null;
  limit?: number;
  offset?: number;
}

export class SearchCustomersService {
  constructor(
    private readonly repository: CustomerRepository
  ) {}

  async execute(
    input: SearchCustomersInput
  ): Promise<Customer[]> {
    const query = input.query?.trim() ?? '';
    const limit = input.limit ?? 50;
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

    if (!query) {
      return this.repository.listByShop(
        input.shopId,
        limit,
        offset
      );
    }

    return this.repository.search(
      input.shopId,
      query,
      limit,
      offset
    );
  }
}