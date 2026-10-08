
import type { LedgerHistoryWithBalance } from '@/repositories/ledger';

export interface LedgerSection {
  title: string;
  data: LedgerHistoryWithBalance[];
}

export function groupLedgerEntries(
  entries: LedgerHistoryWithBalance[]
): LedgerSection[] {
  const sections: LedgerSection[] = [];

  for (const entry of entries) {
    const title = formatSectionTitle(entry.occurred_at);
    const last = sections[sections.length - 1];

    if (last?.title === title) {
      last.data.push(entry);
    } else {
      sections.push({ title, data: [entry] });
    }
  }

  return sections;
}

function formatSectionTitle(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const yesterday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1
  );

  const activityDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  if (activityDay.getTime() === today.getTime()) {
    return 'TODAY';
  }

  if (activityDay.getTime() === yesterday.getTime()) {
    return 'YESTERDAY';
  }

  return date
    .toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();
}
