
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { ITEM_UNITS } from '@/config/item-units';

import {
  SupplierItemRepository,
} from '@/repositories/item/supplier-item';

import {
  SyncOutboxRepository,
} from '@/repositories/sync/sync-outbox';

import {
  CreateSupplierItemService,
} from '@/services/supplier-item/create';

import {
  UpdateSupplierItemService,
} from '@/services/supplier-item/update';

import {
  DeleteSupplierItemService,
} from '@/services/supplier-item/delete';

import type { SupplierItem } from '@/types/domain';

const repository = new SupplierItemRepository();
const outboxRepository = new SyncOutboxRepository();

const createService = new CreateSupplierItemService(
  repository,
  outboxRepository
);

const updateService = new UpdateSupplierItemService(
  repository,
  outboxRepository
);

const deleteService = new DeleteSupplierItemService(
  repository,
  outboxRepository
);

export interface SupplierItemFormValues {
  itemId: string;
  unit: string;
  unitPrice: string;
}

const EMPTY_VALUES: SupplierItemFormValues = {
  itemId: '',
  unit: '',
  unitPrice: '',
};

export interface UseSupplierItemFormOptions {
  shopId: string;
  deviceId: string;
  supplierId: string;
  supplierItem?: SupplierItem | null;
}

function isValidUnit(value: string): boolean {
  return ITEM_UNITS.some(
    (option) => option.value === value
  );
}

function parsePurchasePrice(value: string): number {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      'Purchase price must be a nonnegative whole number'
    );
  }

  const price = Number(trimmed);

  if (!Number.isSafeInteger(price)) {
    throw new Error('Purchase price is too large');
  }

  return price;
}

export function useSupplierItemForm({
  shopId,
  deviceId,
  supplierId,
  supplierItem,
}: UseSupplierItemFormOptions) {
  const [values, setValues] =
    useState<SupplierItemFormValues>(EMPTY_VALUES);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!supplierItem) {
      setValues({ ...EMPTY_VALUES });
      return;
    }

    setValues({
      itemId: supplierItem.item_id,
      unit: supplierItem.unit,
      unitPrice: String(supplierItem.unit_price),
    });
  }, [supplierItem]);

  const onChange = useCallback(
    (
      field: keyof SupplierItemFormValues,
      value: string
    ) => {
      setValues((current) => ({
        ...current,
        [field]: value,
      }));

      setError(null);
    },
    []
  );

  const validate = useCallback(() => {
    const itemId = values.itemId.trim();
    const unit = values.unit.trim();

    if (!supplierItem && !itemId) {
      throw new Error('Select a product');
    }

    if (!unit) {
      throw new Error('Select a purchase unit');
    }

    if (!isValidUnit(unit)) {
      throw new Error(
        'Select a valid purchase unit from the predefined list'
      );
    }

    return {
      itemId,
      unit,
      unitPrice: parsePurchasePrice(
        values.unitPrice
      ),
    };
  }, [values, supplierItem]);

  const save = useCallback(
    async (): Promise<boolean> => {
      if (saving || deleting) {
        return false;
      }

      setSaving(true);
      setError(null);

      try {
        const validated = validate();

        if (supplierItem) {
          await updateService.execute({
            id: supplierItem.id,
            shopId,
            deviceId,
            supplierId,
            unit: validated.unit,
            unitPrice: validated.unitPrice,
          });
        } else {
          await createService.execute({
            shopId,
            deviceId,
            supplierId,
            itemId: validated.itemId,
            unit: validated.unit,
            unitPrice: validated.unitPrice,
          });
        }

        return true;
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to save supplier product'
        );

        return false;
      } finally {
        setSaving(false);
      }
    },
    [
      shopId,
      deviceId,
      supplierId,
      supplierItem,
      validate,
      saving,
      deleting,
    ]
  );

  const deleteItem = useCallback(
    async (): Promise<boolean> => {
      if (!supplierItem || saving || deleting) {
        return false;
      }

      setDeleting(true);
      setError(null);

      try {
        await deleteService.execute({
          id: supplierItem.id,
          shopId,
          deviceId,
          supplierId,
        });

        return true;
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to delete supplier product'
        );

        return false;
      } finally {
        setDeleting(false);
      }
    },
    [
      shopId,
      deviceId,
      supplierId,
      supplierItem,
      saving,
      deleting,
    ]
  );

  return {
    values,
    onChange,
    saving,
    deleting,
    error,
    save,
    deleteItem,
  };
}
