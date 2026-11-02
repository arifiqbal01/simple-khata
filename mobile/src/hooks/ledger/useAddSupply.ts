
/**
 * Legacy import compatibility for Supplier Supply.
 *
 * The implementation has moved to:
 * src/hooks/ledger/supply/useAddSupply.ts
 *
 * Keep this file so existing screens importing
 * '@/hooks/ledger/useAddSupply' continue to resolve.
 */

export {
  useAddSupply,
} from './supply/useAddSupply';

export type {
  DraftSupplyItem,
  AvailableSupplyItem,
  SupplyEntryMode,
  SupplierParty,
  SupplySupplierState,
  SupplyCatalogState,
  SupplyTotalsState,
} from './supply/types';
