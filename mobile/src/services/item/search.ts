
import { ItemRepository } from '@/repositories/item/item';
import type { Item } from '@/types/domain';

export interface SearchItemsInput {
  shopId: string;
  query?: string;
  limit?: number;
  offset?: number;
}

export class SearchItemsService {
  constructor(
    private readonly itemRepository: ItemRepository
  ) {}

  async execute(
    input: SearchItemsInput
  ): Promise<Item[]> {
    const shopId = input.shopId.trim();
    const query = input.query?.trim() ?? '';

    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    if (!shopId) {
      throw new Error('Shop ID is required');
    }

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
        'Offset cannot be negative'
      );
    }

    if (!query) {
      return this.itemRepository.listByShop(
        shopId,
        limit,
        offset
      );
    }

    return this.itemRepository.search(
      shopId,
      query,
      limit,
      offset
    );
  }
}
