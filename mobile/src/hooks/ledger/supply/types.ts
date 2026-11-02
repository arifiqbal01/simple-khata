
export type SupplyEntryMode = 'amount' | 'quantity';

export interface AvailableSupplyItem {
  id: string;
  item_id: string;
  item_name: string;
  unit: string;
  unit_price: number;
}

export interface SupplierParty {
  id: string;
  type: 'CUSTOMER' | 'SUPPLIER';
  name: string;
}

export interface DraftSupplyItem {
  id: string;
  itemId: string | null;
  name: string;

  // Exact whole-rupee amount.
  // Authoritative in amount mode.
  amount: string;

  // Positive quantity, maximum 3 decimal places.
  // Approximate when derived from an amount.
  quantity: string;

  // Supplier-configured unit and purchase price.
  unit: string;
  unitPrice: string;
}

export interface SupplySupplierState {
  shopId: string | null;
  deviceId: string | null;
  supplier: SupplierParty | null;
  balance: number;
  loading: boolean;
  error: string | null;
}

export interface SupplyCatalogState {
  availableItems: AvailableSupplyItem[];
  loading: boolean;
  error: string | null;
}

export interface SupplyTotalsState {
  itemizedTotal: number;
  hasSelectedItems: boolean;
  validItems: boolean;
  validAmount: boolean;
  totalAmount: number;
  projectedBalance: number;
}
