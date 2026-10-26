
import { PartyRepository } from '@/repositories/party/party';
import type { Party, PartyType } from '@/types/domain';

export interface SearchPartiesInput {
  shopId: string;
  type: PartyType;
  query?: string | null;
  limit?: number;
  offset?: number;
}

export class SearchPartiesService {
  constructor(
    private readonly repository: PartyRepository
  ) {}

  async execute(
    input: SearchPartiesInput
  ): Promise<Party[]> {
    const shopId = input.shopId.trim();

    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    if (
      input.type !== 'CUSTOMER' &&
      input.type !== 'SUPPLIER'
    ) {
      throw new Error('Invalid party type');
    }

    const query = input.query?.trim() ?? '';
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new Error(
        'Limit must be an integer between 1 and 100'
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

    /*
     * Empty query: list all active Parties
     * of the requested type in this shop.
     */
    if (!query) {
      return this.repository.listByShop(
        shopId,
        input.type,
        limit,
        offset
      );
    }

    /*
     * Non-empty query: search active Parties
     * by name or phone, using repository SQL.
     */
    return this.repository.search(
      shopId,
      input.type,
      query,
      limit,
      offset
    );
  }
}