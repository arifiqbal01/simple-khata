export interface SupplierItemSyncData {
  id: string;
  shopId: string;
  supplierId: string;
  itemId: string;
  unit: string;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierItemSyncPayload {
  supplierItem: SupplierItemSyncData;
}

export interface SupplierItemDeletePayload {
  supplierItem: {
    id: string;
    shopId: string;
    supplierId: string;
    itemId: string;
  };
}

export type SupplierItemSyncOperationType =
  | 'SUPPLIER_ITEM_CREATE'
  | 'SUPPLIER_ITEM_UPDATE'
  | 'SUPPLIER_ITEM_DELETE';