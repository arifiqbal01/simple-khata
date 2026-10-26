
import type { Item } from '@/types/domain';

import { ItemRepository } from '@/repositories/item/item';

import type {
  QuickItemsRepository,
} from '@/repositories/item/quick-items';

import {
  DEFAULT_QUICK_ITEMS,
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
  item: Item | undefined,
  fallbackName: string,
  score: number
): QuickItem {
  return {
    id: item?.id ?? null,
    name: item?.name ?? fallbackName,
    score,
    defaultUnit: item?.default_unit ?? null,
    defaultSellingPrice:
      item?.default_selling_price ?? null,
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
     * Collect product IDs and names from usage
     * history and starter Quick Items.
     */
    const usageIds = usage
      .map((record) => record.itemId)
      .filter(
        (id): id is string =>
          typeof id === 'string' &&
          id.trim().length > 0
      );

    const names = [
      ...usage.map((record) => record.name),
      ...DEFAULT_QUICK_ITEMS,
    ];

    /*
     * Fetch from the entire SQLite catalog.
     * These queries are not restricted by the
     * first 100 products loaded by the UI.
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
        names
      ),
    ]);

    /*
     * Merge all resolved catalog records.
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
     * Preserve historical usage ranking.
     */
    for (const record of usage) {
      const key = normalize(record.name);

      if (!key) {
        continue;
      }

      const catalogItem =
        (record.itemId
          ? catalogById.get(record.itemId)
          : undefined) ??
        catalogByName.get(key);

      const score =
        record.customerCount * 5 +
        record.timeCount * 3 +
        record.totalCount * 2;

      const quickItem = toQuickItem(
        catalogItem,
        record.name,
        score
      );

      const resolvedKey = normalize(
        quickItem.name
      );

      const existing = ranked.get(resolvedKey);

      if (
        !existing ||
        quickItem.score > existing.score
      ) {
        ranked.set(resolvedKey, quickItem);
      }
    }

    /*
     * Add starter suggestions not already
     * represented in historical usage.
     */
    for (
      const [index, name] of
      DEFAULT_QUICK_ITEMS.entries()
    ) {
      const key = normalize(name);

      if (!key) {
        continue;
      }

      const catalogItem =
        catalogByName.get(key);

      const quickItem = toQuickItem(
        catalogItem,
        name,
        (DEFAULT_QUICK_ITEMS.length - index) *
          0.01
      );

      const resolvedKey = normalize(
        quickItem.name
      );

      if (!ranked.has(resolvedKey)) {
        ranked.set(
          resolvedKey,
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
        QUICK_ITEMS_VISIBLE_LIMIT
      );
  }
}
