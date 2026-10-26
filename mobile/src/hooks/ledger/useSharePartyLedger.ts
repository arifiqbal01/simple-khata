
import {
  useCallback,
  useRef,
  useState,
} from 'react';

import { Alert } from 'react-native';

import { LedgerSummaryRepository } from '@/repositories/ledger/ledger-summary';
import { PartyRepository } from '@/repositories/party/party';

import { shareLedgerOnWhatsApp } from '@/utils/ledger/share-whatsapp';

export type SharePartyType =
  | 'CUSTOMER'
  | 'SUPPLIER';

export interface UseSharePartyLedgerOptions {
  shopId: string;
  partyId: string;
  partyType: SharePartyType;
  partyName: string;
  shopName: string;
}

const ledgerSummaryRepository =
  new LedgerSummaryRepository();

const partyRepository =
  new PartyRepository();

export function useSharePartyLedger({
  shopId,
  partyId,
  partyType,
  partyName,
  shopName,
}: UseSharePartyLedgerOptions) {
  const [isSharing, setIsSharing] =
    useState(false);

  const sharingRef = useRef(false);

  const share = useCallback(
    async (): Promise<void> => {
      // Prevent multiple simultaneous share actions.
      if (sharingRef.current) {
        return;
      }

      if (!shopId || !partyId) {
        Alert.alert(
          'Unable to share',
          'Shop or party information is missing.'
        );
        return;
      }

      sharingRef.current = true;
      setIsSharing(true);

      try {
        // Verify that the party belongs to this shop.
        const party =
          await partyRepository.getByIdAndShop(
            partyId,
            shopId
          );

        if (!party || party.type !== partyType) {
          throw new Error(
            partyType === 'CUSTOMER'
              ? 'Customer not found in this shop'
              : 'Supplier not found in this shop'
          );
        }

        const resolvedPartyName =
          partyName.trim() || party.name;

        const resolvedShopName = shopName.trim();

        if (partyType === 'CUSTOMER') {
          // Customer balance:
          // UDHAAR - PAYMENT
          const summary =
            await ledgerSummaryRepository
              .getCustomerLedgerSummary(
                shopId,
                partyId
              );

          await shareLedgerOnWhatsApp({
            shopName: resolvedShopName,
            partyType: 'CUSTOMER',
            partyName: resolvedPartyName,
            totalAmount: summary.totalUdhaar,
            totalPayments: summary.totalPayments,
            outstanding: summary.outstanding,
          });
        } else {
          // Supplier balance:
          // SUPPLY - PAYMENT
          const summary =
            await ledgerSummaryRepository
              .getSupplierLedgerSummary(
                shopId,
                partyId
              );

          await shareLedgerOnWhatsApp({
            shopName: resolvedShopName,
            partyType: 'SUPPLIER',
            partyName: resolvedPartyName,
            totalAmount: summary.totalSupply,
            totalPayments: summary.totalPayments,
            outstanding: summary.outstanding,
          });
        }
      } catch (error) {
        console.error(
          '[party-ledger] WhatsApp sharing failed:',
          error
        );

        Alert.alert(
          'Unable to share',
          error instanceof Error
            ? error.message
            : 'Could not open WhatsApp. Please try again.'
        );
      } finally {
        sharingRef.current = false;
        setIsSharing(false);
      }
    },
    [
      shopId,
      partyId,
      partyType,
      partyName,
      shopName,
    ]
  );

  return {
    share,
    isSharing,
  };
}
