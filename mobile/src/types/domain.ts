export type LedgerEntryType = 'UDHAAR' | 'PAYMENT';

export interface Shop {
  id: string;
  name: string;
  created_at: string;
}

export interface Device {
  id: string;
  shop_id: string;
  name: string | null;
  last_sync_at: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  shop_id: string;
  name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  shop_id: string;
  name: string;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  customer_id: string;
  device_id: string;
  type: LedgerEntryType;
  amount: number;
  note: string | null;
  occurred_at: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by_device_id: string | null;
}

export interface EntryItem {
  id: string;
  ledger_entry_id: string;
  item_id: string | null;
  name: string;
  amount: number | null;
}