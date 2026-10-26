
export type PartyType = 'CUSTOMER' | 'SUPPLIER';

export type LedgerEntryType =
  | 'UDHAAR'
  | 'SUPPLY'
  | 'PAYMENT';

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

/**
 * Shared customer/supplier domain model.
 *
 * This is the target model for SQLite migration v6.
 */
export interface Party {
  id: string;
  shop_id: string;
  type: PartyType;
  name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by_device_id: string | null;
}

/**
 * Temporary compatibility type.
 *
 * Existing customer code still uses the v5 SQLite
 * schema. Remove this interface after those
 * repositories and services are migrated to Party.
 */
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

  // Added in SQLite migration v6.
  default_unit?: string | null;
  default_selling_price?: number | null;
  deleted_at?: string | null;
  deleted_by_device_id?: string | null;
}

export interface SupplierItem {
  id: string;
  shop_id: string;
  supplier_id: string;
  item_id: string;
  unit: string;
  unit_price: number;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  device_id: string;
  type: LedgerEntryType;
  amount: number;
  note: string | null;
  occurred_at: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by_device_id: string | null;

  /**
   * Legacy v5 relationship.
   * Required until repository migration.
   */
  customer_id: string;

  /**
   * Target v6 relationship.
   */
  party_id?: string;
}

export interface EntryItem {
  id: string;
  ledger_entry_id: string;
  item_id: string | null;
  name: string;
  amount: number | null;

  // Added in SQLite migration v6.
  quantity?: string | null;
  unit?: string | null;
  unit_price?: number | null;
}
