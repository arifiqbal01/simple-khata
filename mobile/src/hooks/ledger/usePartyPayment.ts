
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { PartyRepository } from '@/repositories/party/party';
import { LedgerRepository } from '@/repositories/ledger/ledger';
import { LedgerSummaryRepository } from '@/repositories/ledger/ledger-summary';
import { LocalIdentityRepository } from '@/repositories/bootstrap/local-identity';
import { syncOutboxRepository } from '@/repositories/sync/sync-outbox';

import { RecordPaymentService } from '@/services/ledger/record-payment';

export type PartyType = 'CUSTOMER' | 'SUPPLIER';

type Party = NonNullable<
  Awaited<ReturnType<PartyRepository['getByIdAndShop']>>
>;

const partyRepository = new PartyRepository();
const ledgerRepository = new LedgerRepository();
const ledgerSummaryRepository =
  new LedgerSummaryRepository();

const identityRepository =
  new LocalIdentityRepository();

const paymentService = new RecordPaymentService(
  ledgerRepository,
  partyRepository,
  syncOutboxRepository
);

export function usePartyPayment(
  partyId?: string,
  partyType: PartyType = 'CUSTOMER'
) {
  const [shopId, setShopId] =
    useState<string | null>(null);

  const [deviceId, setDeviceId] =
    useState<string | null>(null);

  const [party, setParty] =
    useState<Party | null>(null);

  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const savingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function initialize(): Promise<void> {
      setLoading(true);
      setError(null);

      setParty(null);
      setShopId(null);
      setDeviceId(null);
      setBalance(0);
      setAmount('');

      try {
        if (!partyId?.trim()) {
          throw new Error(
            partyType === 'SUPPLIER'
              ? 'Supplier ID is missing'
              : 'Customer ID is missing'
          );
        }

        const identity =
          await identityRepository.get();

        if (
          !identity ||
          !identity.shopId?.trim() ||
          !identity.deviceId?.trim()
        ) {
          throw new Error(
            'Local installation identity not found'
          );
        }

        const currentParty =
          await partyRepository.getByIdAndShop(
            partyId,
            identity.shopId
          );

        if (
          !currentParty ||
          currentParty.type !== partyType
        ) {
          throw new Error(
            partyType === 'SUPPLIER'
              ? 'Supplier not found'
              : 'Customer not found'
          );
        }

        const currentBalance =
          partyType === 'SUPPLIER'
            ? await ledgerSummaryRepository.getSupplierBalance(
                identity.shopId,
                partyId
              )
            : await ledgerSummaryRepository.getCustomerBalance(
                identity.shopId,
                partyId
              );

        if (cancelled) {
          return;
        }

        setShopId(identity.shopId);
        setDeviceId(identity.deviceId);
        setParty(currentParty);
        setBalance(currentBalance);
      } catch (cause) {
        if (cancelled) {
          return;
        }

        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load party'
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [partyId, partyType]);

  const parsedAmount = useMemo(
    () => Number(amount.trim()),
    [amount]
  );

  const validAmount =
    amount.trim().length > 0 &&
    Number.isSafeInteger(parsedAmount) &&
    parsedAmount > 0;

  const remainingBalance = validAmount
    ? balance - parsedAmount
    : balance;

  const isOverpayment =
    validAmount && parsedAmount > balance;

  const payFull = useCallback(() => {
    if (balance > 0) {
      setAmount(String(balance));
    }
  }, [balance]);

  const save = useCallback(
    async (): Promise<boolean> => {
      if (savingRef.current) {
        return false;
      }

      if (
        !partyId?.trim() ||
        !shopId?.trim() ||
        !deviceId?.trim() ||
        !party ||
        party.type !== partyType
      ) {
        throw new Error(
          'Party or device is not ready'
        );
      }

      const value = Number(amount.trim());

      if (
        !amount.trim() ||
        !Number.isSafeInteger(value) ||
        value <= 0
      ) {
        throw new Error(
          'Enter a valid whole rupee amount'
        );
      }

      savingRef.current = true;
      setSaving(true);

      try {
        await paymentService.execute({
          shopId,
          partyId,
          deviceId,
          amount: value,
          partyType,
        });

        return true;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [
      amount,
      party,
      partyId,
      partyType,
      shopId,
      deviceId,
    ]
  );

  return {
    party,
    balance,
    amount,
    setAmount,

    loading,
    saving,
    error,

    parsedAmount,
    validAmount,
    remainingBalance,
    isOverpayment,

    payFull,
    save,
  };
}
