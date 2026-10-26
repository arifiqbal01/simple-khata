
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { ItemRepository } from '@/repositories/item/item';
import { SyncOutboxRepository } from '@/repositories/sync/sync-outbox';

import { CreateItemService } from '@/services/item/create';
import { DeleteItemService } from '@/services/item/delete';
import { UpdateItemService } from '@/services/item/update';

import type { Item } from '@/types/domain';
import type { ItemFormValues } from '@/components/item';

const itemRepository = new ItemRepository();
const outboxRepository = new SyncOutboxRepository();

const createItemService = new CreateItemService(
  itemRepository,
  outboxRepository
);

const deleteItemService = new DeleteItemService(
  itemRepository,
  outboxRepository
);

const updateItemService = new UpdateItemService(
  itemRepository,
  outboxRepository
);

const EMPTY_VALUES: ItemFormValues = {
  name: '',
  defaultUnit: '',
  defaultSellingPrice: '',
};

export interface UseItemFormOptions {
  shopId: string;
  deviceId: string;
  item?: Item | null;
}

function parseSellingPrice(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      'Selling price must be a whole number'
    );
  }

  const price = Number(trimmed);

  if (!Number.isSafeInteger(price)) {
    throw new Error('Selling price is too large');
  }

  return price;
}

export function useItemForm({
  shopId,
  deviceId,
  item,
}: UseItemFormOptions) {
  const [values, setValues] =
    useState<ItemFormValues>(EMPTY_VALUES);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!item) {
      setValues({ ...EMPTY_VALUES });
      return;
    }

    setValues({
      name: item.name,
      defaultUnit: item.default_unit ?? '',
      defaultSellingPrice:
        item.default_selling_price === null
          ? ''
          : String(item.default_selling_price),
    });
  }, [item]);

  const onChange = useCallback(
    (
      field: keyof ItemFormValues,
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
    const name = values.name.trim();
    const defaultUnit =
      values.defaultUnit.trim() || null;

    if (!name) {
      throw new Error('Item name is required');
    }

    if (name.length > 150) {
      throw new Error(
        'Item name cannot exceed 150 characters'
      );
    }

    if (defaultUnit && defaultUnit.length > 30) {
      throw new Error(
        'Unit cannot exceed 30 characters'
      );
    }

    return {
      name,
      defaultUnit,
      defaultSellingPrice: parseSellingPrice(
        values.defaultSellingPrice
      ),
    };
  }, [values]);

  const save = useCallback(async (): Promise<
    Item | null
  > => {
    if (saving || deleting) {
      return null;
    }

    setSaving(true);
    setError(null);

    try {
      const validated = validate();

      if (item) {
        return await updateItemService.execute({
          shopId,
          deviceId,
          itemId: item.id,
          ...validated,
        });
      }

      return await createItemService.execute({
        shopId,
        deviceId,
        ...validated,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to save item'
      );

      return null;
    } finally {
      setSaving(false);
    }
  }, [
    shopId,
    deviceId,
    item,
    validate,
    saving,
    deleting,
  ]);

  const deleteItem = useCallback(async (): Promise<
    boolean
  > => {
    if (!item || saving || deleting) {
      return false;
    }

    setDeleting(true);
    setError(null);

    try {
      const deleted = await deleteItemService.execute({
        shopId,
        deviceId,
        itemId: item.id,
      });

      if (!deleted) {
        throw new Error('Item could not be deleted');
      }

      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to delete item'
      );

      return false;
    } finally {
      setDeleting(false);
    }
  }, [
    shopId,
    deviceId,
    item,
    saving,
    deleting,
  ]);

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
