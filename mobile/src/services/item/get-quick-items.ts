
import type { Item } from '@/types/domain';

import { ItemRepository } from '@/repositories/item/item';

import type {
  QuickItemsRepository,
} from '@/repositories/item/quick-items';

import {
  QUICK_ITEMS_VISIBLE_LIMIT,
} from '@/config/quick-items';

export interface QuickItem {
  id: string | null;
  name: string;
  score: number;
  defaultUnit: string | null;
  defaultSellingPrice: number | null;
}

export interface GetQuickItemsInput {
  shopId: string;
  customerId: string;
  availableItems: Item[];
  now?: Date;
}

function normalize(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function getTimeWindow(
  hour: number
): [number, number] {
  if (hour >= 5 && hour < 11) {
    return [5, 11];
  }

  if (hour >= 11 && hour < 16) {
    return [11, 16];
  }

  if (hour >= 16 && hour < 22) {
    return [16, 22];
  }

  return [22, 5];
}

function daysAgo(
  now: Date,
  days: number
): string {
  return new Date(
    now.getTime() -
      days * 24 * 60 * 60 * 1000
  ).toISOString();
}

function toQuickItem(
  item: Item,
  score: number
): QuickItem {
  return {
    id: item.id,
    name: item.name,
    score,
    defaultUnit: item.default_unit ?? null,
    defaultSellingPrice:
      item.default_selling_price ?? null,
  };
}

export class GetQuickItemsService {
  private readonly itemRepository =
    new ItemRepository();

  constructor(
    private readonly repository: QuickItemsRepository
  ) {}

  async execute(
    input: GetQuickItemsInput
  ): Promise<QuickItem[]> {
    const shopId = input.shopId.trim();
    const customerId = input.customerId.trim();

    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const now = input.now ?? new Date();

    if (Number.isNaN(now.getTime())) {
      throw new Error('Invalid current date');
    }

    const [startHour, endHour] =
      getTimeWindow(now.getHours());

    /*
     * Read actual item usage history.
     *
     * Preserve existing scoring inputs:
     * - Customer-specific frequency
     * - Time-of-day frequency
     * - Overall frequency
     * - Recent usage windows
     */
    const usage = await this.repository.getUsage({
      shopId,
      customerId,
      startHour,
      endHour,
      since: daysAgo(now, 60),
      recentSince: daysAgo(now, 14),
      timezoneOffsetMinutes:
        now.getTimezoneOffset(),
    });

    /*
     * No usage history means no suggestions.
     * Never fall back to predefined item names.
     */
    if (usage.length === 0) {
      return [];
    }

    const usageIds = [
      ...new Set(
        usage
          .map((record) => record.itemId)
          .filter(
            (id): id is string =>
              typeof id === 'string' &&
              id.trim().length > 0
          )
      ),
    ];

    const usageNames = [
      ...new Set(
        usage
          .map((record) => record.name.trim())
          .filter((name) => name.length > 0)
      ),
    ];

    /*
     * Resolve historically used items from
     * the entire SQLite catalog, not just
     * the first page loaded by the screen.
     */
    const [
      itemsById,
      itemsByName,
    ] = await Promise.all([
      this.itemRepository.getManyByIds(
        shopId,
        usageIds
      ),
      this.itemRepository.getManyByNames(
        shopId,
        usageNames
      ),
    ]);

    /*
     * Merge catalog records.
     * availableItems is only a supplemental cache.
     */
    const activeItems = [
      ...input.availableItems,
      ...itemsByName,
      ...itemsById,
    ].filter(
      (item) =>
        item.shop_id === shopId &&
        item.deleted_at == null
    );

    const catalogById = new Map<string, Item>();
    const catalogByName = new Map<string, Item>();

    for (const item of activeItems) {
      catalogById.set(item.id, item);

      catalogByName.set(
        normalize(item.name),
        item
      );
    }

    const ranked = new Map<string, QuickItem>();

    /*
     * Only include items backed by actual
     * historical usage AND an active catalog
     * record.
     */
    for (const record of usage) {
      const nameKey = normalize(record.name);

      if (!nameKey) {
        continue;
      }

      const catalogItem =
        (record.itemId
          ? catalogById.get(record.itemId)
          : undefined) ??
        catalogByName.get(nameKey);

      if (!catalogItem) {
        continue;
      }

      const score =
        record.customerCount * 5 +
        record.timeCount * 3 +
        record.totalCount * 2;

      if (
        !Number.isFinite(score) ||
        score <= 0
      ) {
        continue;
      }

      const quickItem = toQuickItem(
        catalogItem,
        score
      );

      /*
       * Deduplicate by actual catalog ID.
       * Preserve the highest-ranked usage record.
       */
      const existing = ranked.get(catalogItem.id);

      if (
        !existing ||
        quickItem.score > existing.score
      ) {
        ranked.set(
          catalogItem.id,
          quickItem
        );
      }
    }

    return [...ranked.values()]
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.name.localeCompare(b.name)
      )
      .slice(
        0,
        Math.min(5, QUICK_ITEMS_VISIBLE_LIMIT)
      );
  }
}
