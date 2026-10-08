
import { Linking } from 'react-native';

import { formatRupees } from '@/utils/ledger/format-rupees';

export interface WhatsAppLedgerSummary {
  customerName: string;
  shopName: string;
  totalUdhaar: number;
  totalPayments: number;
  outstanding: number;
}

export async function shareLedgerOnWhatsApp(
  summary: WhatsAppLedgerSummary
): Promise<void> {
  const message = [
    `*${summary.shopName}*`,
    '',
    '*Customer Khata Summary*',
    `Customer: ${summary.customerName}`,
    '',
    `Total Udhaar: Rs ${formatRupees(summary.totalUdhaar)}`,
    `Total Payments: Rs ${formatRupees(summary.totalPayments)}`,
    '',
    `*Outstanding: Rs ${formatRupees(summary.outstanding)}*`,
    '',
    'Shared via Simple Khata',
  ].join('\n');

  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;

  await Linking.openURL(url);
}
