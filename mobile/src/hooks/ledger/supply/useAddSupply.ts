
import { useSupplySupplier } from './useSupplySupplier';
import { useSupplyCatalog } from './useSupplyCatalog';
import { useSupplyItems } from './useSupplyItems';
import { useSupplyTotals } from './useSupplyTotals';
import { useSaveSupply } from './useSaveSupply';

export function useAddSupply(supplierId?: string) {
  const supplierState =
    useSupplySupplier(supplierId);

  const catalogState =
    useSupplyCatalog({
      shopId: supplierState.shopId,
      supplierId: supplierState.supplier?.id,
    });

  const itemsState =
    useSupplyItems(catalogState.availableItems);

  const totalsState =
    useSupplyTotals({
      items: itemsState.items,
      mode: itemsState.mode,
      availableItems: catalogState.availableItems,
      balance: supplierState.balance,
    });

  const saveState =
    useSaveSupply({
      shopId: supplierState.shopId,
      deviceId: supplierState.deviceId,
      supplierId:
        supplierState.supplier?.id,
      supplierValid:
        supplierState.supplier?.type ===
        'SUPPLIER',
      items: itemsState.items,
      mode: itemsState.mode,
      availableItems: catalogState.availableItems,
      catalogLoading: catalogState.loading,
      validAmount: totalsState.validAmount,
      totalAmount: totalsState.totalAmount,
    });

  return {
    shopId: supplierState.shopId,
    deviceId: supplierState.deviceId,
    supplier: supplierState.supplier,
    balance: supplierState.balance,

    availableItems:
      catalogState.availableItems,

    ...itemsState,
    ...totalsState,
    ...saveState,

    loading:
      supplierState.loading ||
      catalogState.loading,

    error:
      saveState.error ??
      supplierState.error ??
      catalogState.error,
  };
}
