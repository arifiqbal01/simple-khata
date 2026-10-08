
import type { Item } from '@/types/domain';

import {
  QuickItemsRepository,
} from '@/repositories/quick-items';

import {
  DEFAULT_QUICK_ITEMS,
  QUICK_ITEMS_VISIBLE_LIMIT,
} from '@/config/quick-items';

export interface QuickItem {
  id: string | null;
  name: string;
  score: number;
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

  // Overnight: 10 PM to 5 AM
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

export class GetQuickItemsService {
  constructor(
    private readonly repository: QuickItemsRepository
  ) {}

  async execute(input: {
    shopId: string;
    customerId: string;
    availableItems: Item[];
    now?: Date;
  }): Promise<QuickItem[]> {
    const now = input.now ?? new Date();

    const hour = now.getHours();

    const [startHour, endHour] =
      getTimeWindow(hour);

    const usage = await this.repository.getUsage({
      shopId: input.shopId,
      customerId: input.customerId,
      startHour,
      endHour,

      // Last 60 days of transactions.
      since: daysAgo(now, 60),

      // Give last 14 days extra weight.
      recentSince: daysAgo(now, 14),

      timezoneOffsetMinutes:
        now.getTimezoneOffset(),
    });

    const catalog = new Map(
      input.availableItems.map((item) => [
        normalize(item.name),
        item,
      ])
    );

    const ranked = new Map<string, QuickItem>();

    for (const record of usage) {
      const key = normalize(record.name);

      if (!key) continue;

      const catalogItem = catalog.get(key);

      const score =
        record.customerCount * 5 +
        record.timeCount * 3 +
        record.totalCount * 2;

      ranked.set(key, {
        id: catalogItem?.id ?? record.itemId,
        name: catalogItem?.name ?? record.name,
        score,
      });
    }

    // Add default quick items not already ranked.
    for (
      const [index, name] of
      DEFAULT_QUICK_ITEMS.entries()
    ) {
      const key = normalize(name);

      if (!key || ranked.has(key)) continue;

      const catalogItem = catalog.get(key);

      ranked.set(key, {
        id: catalogItem?.id ?? null,
        name: catalogItem?.name ?? name,
        score:
          (DEFAULT_QUICK_ITEMS.length - index) *
          0.01,
      });
    }

    return [...ranked.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, QUICK_ITEMS_VISIBLE_LIMIT);
  }
}
