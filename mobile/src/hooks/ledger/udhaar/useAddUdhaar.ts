
import { useEffect, useRef } from 'react';

import { useUdhaarCustomer } from './useUdhaarCustomer';
import { useUdhaarCatalog } from './useUdhaarCatalog';
import { useUdhaarItems } from './useUdhaarItems';
import { useUdhaarTotals } from './useUdhaarTotals';
import { useSaveUdhaar } from './useSaveUdhaar';

export function useAddUdhaar(customerId?: string) {
  const customerState =
    useUdhaarCustomer(customerId);

  const catalog = useUdhaarCatalog({
    shopId: customerState.shopId,
    customerId,
  });

  const itemState = useUdhaarItems(
    catalog.availableItems
  );

  const totals = useUdhaarTotals(
    itemState.selectedItems,
    itemState.mode
  );

  const saveState = useSaveUdhaar({
    customerId,
    customerState,
    availableItems: catalog.availableItems,
    items: itemState.items,
    totals,
    mode: itemState.mode,
  });

  /*
   * Clear transaction inputs when switching
   * customers, but preserve the selected mode.
   */
  const previousCustomerId = useRef(customerId);

  useEffect(() => {
    if (previousCustomerId.current !== customerId) {
      previousCustomerId.current = customerId;

      itemState.clearItems();
      totals.setAmount('');
    }
  }, [
    customerId,
    itemState.clearItems,
    totals.setAmount,
  ]);

  const loading =
    customerState.loading ||
    (customerState.shopId !== null && catalog.loading);

  const error =
    customerState.error ?? catalog.error;

  return {
    // Local shop and device identity.
    shopId: customerState.shopId,
    deviceId: customerState.deviceId,

    // Customer details.
    customer: customerState.customer,
    balance: customerState.balance,

    // Standalone amount-only entry.
    amount: totals.amount,
    setAmount: totals.setAmount,

    // Shared transaction entry mode.
    mode: itemState.mode,
    setMode: itemState.setMode,

    // Catalog and transaction items.
    items: itemState.items,
    availableItems: catalog.availableItems,
    quickItems: catalog.quickItems,
    selectedItems: itemState.selectedItems,
    draftItems: itemState.draftItems,

    // Loading and error state.
    loading,
    saving: saveState.saving,
    error,

    // Amount calculations.
    validAmount: totals.validAmount,
    parsedAmount: totals.parsedAmount,
    itemizedTotal: totals.itemizedTotal,
    hasSelectedItems: totals.hasSelectedItems,

    hasValidItemInputs:
      itemState.hasValidItemInputs,

    // Item management.
    addItemRow: itemState.addItemRow,
    removeItem: itemState.removeItem,
    clearItems: itemState.clearItems,

    // Atomic item selection and creation.
    addCatalogItem: itemState.addCatalogItem,
    addNewItem: itemState.addNewItem,

    // Item field updates.
    changeItemName: itemState.changeItemName,
    changeItemAmount: itemState.changeItemAmount,
    changeItemQuantity:
      itemState.changeItemQuantity,
    changeItemUnit: itemState.changeItemUnit,
    changeItemUnitPrice:
      itemState.changeItemUnitPrice,

    // Legacy selection actions.
    confirmItem: itemState.confirmItem,
    selectItem: itemState.selectItem,
    toggleAvailableItem:
      itemState.toggleAvailableItem,
    toggleQuickItem: itemState.toggleQuickItem,

    // Offline ledger + sync outbox save.
    save: saveState.save,
  };
}
