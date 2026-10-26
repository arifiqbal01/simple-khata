
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
    itemState.selectedItems
  );

  const saveState = useSaveUdhaar({
    customerId,
    customerState,
    availableItems: catalog.availableItems,
    items: itemState.items,
    totals,
  });

  /*
   * Clear transaction inputs when switching
   * between customers.
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
    (
      customerState.shopId !== null &&
      catalog.loading
    );

  const error =
    customerState.error ??
    catalog.error;

  return {
    customer: customerState.customer,
    balance: customerState.balance,

    amount: totals.amount,
    setAmount: totals.setAmount,

    items: itemState.items,
    availableItems: catalog.availableItems,
    quickItems: catalog.quickItems,
    selectedItems: itemState.selectedItems,
    draftItems: itemState.draftItems,

    loading,
    saving: saveState.saving,
    error,

    validAmount: totals.validAmount,
    parsedAmount: totals.parsedAmount,
    itemizedTotal: totals.itemizedTotal,
    hasSelectedItems: totals.hasSelectedItems,

    addItemRow: itemState.addItemRow,
    removeItem: itemState.removeItem,
    clearItems: itemState.clearItems,
    changeItemName: itemState.changeItemName,
    changeItemQuantity:
      itemState.changeItemQuantity,
    changeItemUnit: itemState.changeItemUnit,
    changeItemUnitPrice:
      itemState.changeItemUnitPrice,
    confirmItem: itemState.confirmItem,
    selectItem: itemState.selectItem,
    toggleAvailableItem:
      itemState.toggleAvailableItem,
    toggleQuickItem: itemState.toggleQuickItem,

    save: saveState.save,
  };
}
