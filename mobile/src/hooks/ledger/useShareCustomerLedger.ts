
import { useCallback, useState } from 'react';

import { Alert } from 'react-native';

import { LedgerRepository } from '@/repositories/ledger';

import { shareLedgerOnWhatsApp } from '@/utils/ledger/share-whatsapp';

export interface UseShareCustomerLedgerOptions {
  shopId: string;
  customerId: string;
  customerName: string;
  shopName: string;
}

const ledgerRepository = new LedgerRepository();

export function useShareCustomerLedger({
  shopId,
  customerId,
  customerName,
  shopName,
}: UseShareCustomerLedgerOptions) {
  const [isSharing, setIsSharing] = useState(false);

  const share = useCallback(async () => {
    if (!shopId || !customerId || isSharing) {
      return;
    }

    setIsSharing(true);

    try {
      const summary =
        await ledgerRepository.getCustomerLedgerSummary(
          shopId,
          customerId
        );

      await shareLedgerOnWhatsApp({
        shopName,
        customerName,
        totalUdhaar: summary.totalUdhaar,
        totalPayments: summary.totalPayments,
        outstanding: summary.outstanding,
      });
    } catch (error) {
      console.error('Failed to share customer ledger:', error);

      Alert.alert(
        'Unable to share',
        'Could not open WhatsApp. Please try again.'
      );
    } finally {
      setIsSharing(false);
    }
  }, [
    shopId,
    customerId,
    customerName,
    shopName,
    isSharing,
  ]);

  return {
    share,
    isSharing,
  };
}
