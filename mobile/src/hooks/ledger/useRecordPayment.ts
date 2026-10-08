
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { CustomerRepository } from '@/repositories/customer';
import { LocalIdentityRepository } from '@/repositories/local-identity';
import { LedgerRepository } from '@/repositories/ledger';
import {
  syncOutboxRepository,
} from '@/repositories/sync-outbox';

import { GetCustomerBalanceService } from '@/services/ledger/get-balance';
import { RecordPaymentService } from '@/services/ledger/record-payment';

import type { Customer } from '@/types/domain';

const customerRepository = new CustomerRepository();
const ledgerRepository = new LedgerRepository();
const identityRepository = new LocalIdentityRepository();

const balanceService = new GetCustomerBalanceService(
  ledgerRepository,
  customerRepository
);

const paymentService = new RecordPaymentService(
  ledgerRepository,
  customerRepository,
  syncOutboxRepository
);

export function useRecordPayment(customerId?: string) {
  const [shopId, setShopId] = useState<string | null>(
    null
  );
  const [deviceId, setDeviceId] = useState<string | null>(
    null
  );

  const [customer, setCustomer] = useState<Customer | null>(
    null
  );
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      setError(null);
      setCustomer(null);
      setShopId(null);
      setDeviceId(null);
      setBalance(0);
      setAmount('');

      try {
        if (!customerId) {
          throw new Error('Customer ID is missing');
        }

        const identity = await identityRepository.get();

        if (!identity) {
          throw new Error(
            'Local installation identity not found'
          );
        }

        const currentCustomer =
          await customerRepository.getByIdAndShop(
            customerId,
            identity.shopId
          );

        if (!currentCustomer) {
          throw new Error('Customer not found');
        }

        const currentBalance =
          await balanceService.execute({
            shopId: identity.shopId,
            customerId,
          });

        if (cancelled) return;

        setShopId(identity.shopId);
        setDeviceId(identity.deviceId);
        setCustomer(currentCustomer);
        setBalance(currentBalance);
      } catch (cause) {
        if (cancelled) return;

        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load customer'
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
  }, [customerId]);

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

  const save = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) return false;

    if (!customerId || !shopId || !deviceId) {
      throw new Error(
        'Customer or device is not ready'
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
        customerId,
        deviceId,
        amount: value,
      });

      return true;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [amount, customerId, shopId, deviceId]);

  return {
    customer,
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
