import { ItemRepository } from '@/repositories/item';
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
    if (!input.shopId) {
      throw new Error('Shop ID is required');
    }

    const query = input.query?.trim() ?? '';
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error(
        'Limit must be between 1 and 100'
      );
    }

    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error(
        'Offset cannot be negative'
      );
    }

    if (!query) {
      return this.itemRepository.listByShop(
        input.shopId,
        limit,
        offset
      );
    }

    return this.itemRepository.search(
      input.shopId,
      query,
      limit,
      offset
    );
  }
}