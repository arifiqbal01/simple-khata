
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
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new Error(
        'Limit must be between 1 and 100'
      );
    }

    if (
      !Number.isSafeInteger(offset) ||
      offset < 0
    ) {
      throw new Error(
        'Offset cannot be negative'
      );
    }

    /*
     * Empty queries retain the existing
     * catalog browsing behavior.
     *
     * The Udhaar bottom sheet handles
     * empty queries separately by showing
     * genuinely most-used items.
     */
    if (!query) {
      return this.itemRepository.listByShop(
        shopId,
        limit,
        offset
      );
    }

    /*
     * Search the full shop catalog in SQLite.
     *
     * Exact / prefix / substring ranking
     * must be implemented in the repository
     * before LIMIT and OFFSET are applied.
     */
    return this.itemRepository.search(
      shopId,
      query,
      limit,
      offset
    );
  }
}
