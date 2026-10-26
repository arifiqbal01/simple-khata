
import { Linking } from 'react-native';

import { formatRupees } from '@/utils/ledger/format-rupees';

export type WhatsAppPartyType = 'CUSTOMER' | 'SUPPLIER';

export interface WhatsAppLedgerSummary {
  shopName: string;

  // New party-based fields
  partyType?: WhatsAppPartyType;
  partyName?: string;
  totalAmount?: number;

  // Existing fields kept for compatibility
  customerName?: string;
  totalUdhaar?: number;

  totalPayments: number;
  outstanding: number;
}

export async function shareLedgerOnWhatsApp(
  summary: WhatsAppLedgerSummary
): Promise<void> {
  const isSupplier = summary.partyType === 'SUPPLIER';

  const partyName =
    summary.partyName?.trim() ||
    summary.customerName?.trim() ||
    (isSupplier ? 'Supplier' : 'Customer');

  const shopName = summary.shopName.trim();

  const totalAmount =
    summary.totalAmount ?? summary.totalUdhaar ?? 0;

  const partyLabel = isSupplier ? 'Supplier' : 'Customer';

  const transactionLabel = isSupplier
    ? 'Total Supply'
    : 'Total Udhaar';

  /*
   * Customer:
   *   UDHAAR - PAYMENT
   *
   * Supplier:
   *   SUPPLY - PAYMENT
   *
   * Positive customer balance:
   *   Customer owes the shop.
   *
   * Positive supplier balance:
   *   Shop owes the supplier.
   */
  let balanceLabel: string;

  if (summary.outstanding === 0) {
    balanceLabel = 'Balance Settled';
  } else if (isSupplier) {
    balanceLabel =
      summary.outstanding > 0
        ? 'Shop Owes Supplier'
        : 'Supplier Owes Shop';
  } else {
    balanceLabel =
      summary.outstanding > 0
        ? 'Customer Owes Shop'
        : 'Shop Owes Customer';
  }

  const outstandingAmount = Math.abs(
    summary.outstanding
  );

  const message = [
    `*${shopName}*`,
    '',
    `*${partyLabel} Khata Summary*`,
    `${partyLabel}: ${partyName}`,
    '',
    `${transactionLabel}: Rs ${formatRupees(totalAmount)}`,
    `Total Payments: Rs ${formatRupees(summary.totalPayments)}`,
    '',
    `*${balanceLabel}: Rs ${formatRupees(outstandingAmount)}*`,
    '',
    'Shared via Simple Khata',
  ].join('\n');

  const url =
    `https://wa.me/?text=${encodeURIComponent(message)}`;

  await Linking.openURL(url);
}
