
export type TransactionDateFilter =
  | 'recent'
  | 'today'
  | 'yesterday'
  | 'custom';

export interface TransactionFilterState {
  type: TransactionDateFilter;
  from?: string;
  to?: string;
}
