
export interface DraftSupplyItem {
  id: string;
  itemId: string | null;
  name: string;

  // String fields make TextField editing simple.
  quantity: string;
  unit: string;
  unitPrice: string;
}
