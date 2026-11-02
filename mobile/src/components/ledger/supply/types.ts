
export interface DraftSupplyItem {
  id: string;
  itemId: string | null;
  name: string;

  // Editable values remain strings.
  amount: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}
