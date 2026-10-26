
import type { Item } from '@/types/domain';
import type { QuickItem } from '@/services/item/get-quick-items';
import type { PartyRepository } from '@/repositories/party/party';

export type CustomerParty = NonNullable<
  Awaited<ReturnType<PartyRepository['getByIdAndShop']>>
>;

export interface DraftUdhaarItem {
  id: string;
  itemId: string | null;
  name: string;
  source: 'selected' | 'editor';
  quantity: string;
  unit: string;
  unitPrice: string;
}

export interface UdhaarCustomerState {
  shopId: string | null;
  deviceId: string | null;
  customer: CustomerParty | null;
  balance: number;
  loading: boolean;
  error: string | null;
}

export interface UdhaarCatalogState {
  availableItems: Item[];
  quickItems: QuickItem[];
  loading: boolean;
  error: string | null;
}

export interface UdhaarTotalsState {
  amount: string;
  setAmount: (amount: string) => void;
  parsedAmount: number;
  itemizedTotal: number;
  hasSelectedItems: boolean;
  validAmount: boolean;
  effectiveAmount: number;
}
