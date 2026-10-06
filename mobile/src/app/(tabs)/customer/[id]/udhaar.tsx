import React, {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppHeader } from '@/components/layout';
import {
  AppText,
  Button,
  Chip,
  MoneyInput,
  Screen,
  TextField,
} from '@/components/ui';
import { CustomerRepository } from '@/repositories/customer';
import { DeviceRepository } from '@/repositories/device';
import { ItemRepository } from '@/repositories/item';
import { LedgerRepository } from '@/repositories/ledger';
import { ShopRepository } from '@/repositories/shop';
import { CreateItemService } from '@/services/item/create';
import { SearchItemsService } from '@/services/item/search';
import { GetCustomerBalanceService } from '@/services/ledger/get-balance';
import {
  CreateUdhaarService,
  type CreateUdhaarItemInput,
} from '@/services/ledger/create-udhaar';
import type {
  Customer,
  Item,
} from '@/types/domain';

const customerRepository = new CustomerRepository();
const deviceRepository = new DeviceRepository();
const itemRepository = new ItemRepository();
const ledgerRepository = new LedgerRepository();
const shopRepository = new ShopRepository();

const createItemService =
  new CreateItemService(itemRepository);

const searchItemsService =
  new SearchItemsService(itemRepository);

const createUdhaarService =
  new CreateUdhaarService(
    ledgerRepository,
    customerRepository
  );

const getCustomerBalanceService =
  new GetCustomerBalanceService(
    ledgerRepository,
    customerRepository
  );

interface DraftItem {
  id: string;
  itemId: string | null;
  name: string;
}

function createDraftItem(): DraftItem {
  return {
    id: crypto.randomUUID(),
    itemId: null,
    name: '',
  };
}

export default function AddUdhaarScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    from?: string | string[];
    ledgerFrom?: string | string[];
  }>();

  const customerId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const from = Array.isArray(params.from)
    ? params.from[0]
    : params.from;

  const ledgerFrom = Array.isArray(
    params.ledgerFrom
  )
    ? params.ledgerFrom[0]
    : params.ledgerFrom;

  const [shopId, setShopId] = useState<
    string | null
  >(null);

  const [deviceId, setDeviceId] = useState<
    string | null
  >(null);

  const [customer, setCustomer] =
    useState<Customer | null>(null);

  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');

  const [useItems, setUseItems] =
    useState(false);

  const [items, setItems] = useState<
    DraftItem[]
  >([]);

  const [availableItems, setAvailableItems] =
    useState<Item[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        if (!customerId) {
          throw new Error(
            'Customer ID is missing'
          );
        }

        const shop =
          await shopRepository.getFirst();

        if (!shop) {
          throw new Error(
            'Shop has not been initialized'
          );
        }

        const device =
          await deviceRepository.getFirstByShop(
            shop.id
          );

        if (!device) {
          throw new Error(
            'Device has not been initialized'
          );
        }

        const currentCustomer =
          await customerRepository.getByIdAndShop(
            customerId,
            shop.id
          );

        if (!currentCustomer) {
          throw new Error(
            'Customer not found'
          );
        }

        const [
          currentBalance,
          currentItems,
        ] = await Promise.all([
          getCustomerBalanceService.execute({
            shopId: shop.id,
            customerId,
          }),

          searchItemsService.execute({
            shopId: shop.id,
            query: '',
            limit: 100,
          }),
        ]);

        if (cancelled) {
          return;
        }

        setShopId(shop.id);
        setDeviceId(device.id);
        setCustomer(currentCustomer);
        setBalance(currentBalance);
        setAvailableItems(currentItems);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Could not initialize Udhaar screen';

        Alert.alert(
          'Could not load customer',
          message
        );

        console.error(
          'Failed to initialize Udhaar screen:',
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  function handleClose() {
    if (
      from === 'ledger' &&
      customerId
    ) {
      router.replace({
        pathname: '/customer/[id]',
        params: {
          id: customerId,
          from: ledgerFrom ?? 'home',
        },
      });

      return;
    }

    if (from === 'customers') {
      router.replace('/customers');
      return;
    }

    router.replace('/');
  }

  function handleEnableItems() {
    setUseItems(true);

    if (items.length === 0) {
      setItems([createDraftItem()]);
    }
  }

  function handleDisableItems() {
    setUseItems(false);
    setItems([]);
  }

  function handleAddItemRow() {
    setUseItems(true);

    setItems((current) => [
      ...current,
      createDraftItem(),
    ]);
  }

  function handleRemoveItemRow(id: string) {
    setItems((current) =>
      current.filter(
        (item) => item.id !== id
      )
    );
  }

  function updateDraftItem(
    id: string,
    changes: Partial<DraftItem>
  ) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...changes,
            }
          : item
      )
    );
  }

  function handleItemNameChange(
    draftId: string,
    name: string
  ) {
    updateDraftItem(draftId, {
      name,
      itemId: null,
    });
  }

  function handleSelectItem(
    draftId: string,
    item: Item
  ) {
    updateDraftItem(draftId, {
      itemId: item.id,
      name: item.name,
    });
  }

  function handleToggleAvailableItem(
    item: Item
  ) {
    const selected = items.some(
      (draft) => draft.itemId === item.id
    );

    if (selected) {
      setItems((current) =>
        current.filter(
          (draft) =>
            draft.itemId !== item.id
        )
      );

      return;
    }

    setUseItems(true);

    setItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        itemId: item.id,
        name: item.name,
      },
    ]);
  }

  async function prepareItems(): Promise<
    CreateUdhaarItemInput[]
  > {
    if (!useItems) {
      return [];
    }

    if (!shopId) {
      throw new Error(
        'Shop has not been initialized'
      );
    }

    const preparedItems:
      CreateUdhaarItemInput[] = [];

    for (const draft of items) {
      const name = draft.name.trim();

      if (!name) {
        continue;
      }

      let itemId = draft.itemId;

      if (!itemId) {
        const existingItem =
          availableItems.find(
            (item) =>
              item.name
                .trim()
                .toLocaleLowerCase() ===
              name.toLocaleLowerCase()
          );

        if (existingItem) {
          itemId = existingItem.id;
        } else {
          const createdItem =
            await createItemService.execute({
              shopId,
              name,
            });

          itemId = createdItem.id;

          setAvailableItems((current) => [
            ...current,
            createdItem,
          ]);
        }
      }

      preparedItems.push({
        itemId,
        name,
      });
    }

    return preparedItems;
  }

  async function handleSave() {
    if (
      !customerId ||
      !shopId ||
      !deviceId ||
      saving
    ) {
      return;
    }

    const parsedAmount = Number(
      amount.trim()
    );

    if (!Number.isSafeInteger(parsedAmount)) {
      Alert.alert(
        'Invalid amount',
        'Enter a whole rupee amount.'
      );

      return;
    }

    if (parsedAmount <= 0) {
      Alert.alert(
        'Invalid amount',
        'Amount must be greater than zero.'
      );

      return;
    }

    try {
      setSaving(true);

      const preparedItems =
        await prepareItems();

      await createUdhaarService.execute({
        shopId,
        customerId,
        deviceId,
        amount: parsedAmount,
        items: preparedItems,
      });

      handleClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not add Udhaar';

      Alert.alert(
        'Could not add Udhaar',
        message
      );

      console.error(
        'Failed to add Udhaar:',
        error
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  if (!customer) {
    return (
      <Screen>
        <AppHeader
          title="Add Udhaar"
          showBack
          onBackPress={handleClose}
        />

        <View className="flex-1 items-center justify-center px-5">
          <AppText
            variant="body"
            className="text-center text-udhaar"
          >
            Customer could not be loaded.
          </AppText>
        </View>
      </Screen>
    );
  }

  const parsedAmount = Number(
    amount.trim()
  );

  const validAmount =
    Number.isSafeInteger(parsedAmount) &&
    parsedAmount > 0;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <Screen>
        <AppHeader
          title="Add Udhaar"
          showBack
          onBackPress={handleClose}
        />

        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Customer */}
          <View className="pb-8 pt-5">
            <AppText
              className="
                font-spline-bold
                text-[30px]
                leading-[38px]
                text-foreground
              "
            >
              {customer.name}
            </AppText>

            <View className="mt-2 flex-row items-baseline">
              <AppText
                className="
                  font-sans
                  text-[17px]
                  leading-[24px]
                  text-muted
                "
              >
                Current balance
              </AppText>

              <AppText
                className="
                  ml-1.5
                  font-spline-medium
                  text-[17px]
                  leading-[24px]
                  text-foreground
                "
              >
                Rs {balance.toLocaleString()}
              </AppText>
            </View>
          </View>

          {/* Amount */}
          <View className="pt-5">
            <MoneyInput
              label="Amount"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />
          </View>

          {/* Items */}
          <View className="mt-12">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <AppText
                  className="
                    font-spline-medium
                    text-[17px]
                    leading-[24px]
                    text-muted
                  "
                >
                  Items
                </AppText>

                <AppText
                  className="
                    ml-1
                    font-sans
                    text-[17px]
                    leading-[24px]
                    text-muted
                  "
                >
                  · Optional
                </AppText>
              </View>

              {useItems &&
              items.length > 0 ? (
                <Pressable
                  onPress={handleDisableItems}
                  hitSlop={8}
                  className="py-1 active:opacity-60"
                >
                  <AppText
                    variant="small"
                    className="text-udhaar"
                  >
                    Clear
                  </AppText>
                </Pressable>
              ) : null}
            </View>

            {/* Common item chips */}
            {availableItems.length > 0 ? (
              <View className="mt-4 flex-row flex-wrap gap-2">
                {availableItems
                  .slice(0, 6)
                  .map((item) => {
                    const selected =
                      items.some(
                        (draft) =>
                          draft.itemId ===
                          item.id
                      );

                    return (
                      <Chip
                        key={item.id}
                        label={item.name}
                        selected={selected}
                        onPress={() =>
                          handleToggleAvailableItem(
                            item
                          )
                        }
                      />
                    );
                  })}
              </View>
            ) : null}

            {/* Custom item fields */}
            {useItems ? (
              <View className="mt-5 gap-4">
                {items
                  .filter(
                    (draft) =>
                      !draft.itemId
                  )
                  .map((draft) => {
                    const searchName =
                      draft.name
                        .trim()
                        .toLocaleLowerCase();

                    const matches =
                      searchName.length > 0
                        ? availableItems
                            .filter((item) =>
                              item.name
                                .toLocaleLowerCase()
                                .includes(
                                  searchName
                                )
                            )
                            .slice(0, 5)
                        : [];

                    return (
                      <View
                        key={draft.id}
                        className="gap-2"
                      >
                        <View className="flex-row items-center gap-2">
                          <TextField
                            value={draft.name}
                            onChangeText={(
                              value
                            ) =>
                              handleItemNameChange(
                                draft.id,
                                value
                              )
                            }
                            placeholder="Item name"
                            autoCapitalize="words"
                            className="flex-1"
                          />

                          <Pressable
                            onPress={() =>
                              handleRemoveItemRow(
                                draft.id
                              )
                            }
                            accessibilityRole="button"
                            accessibilityLabel="Remove item"
                            hitSlop={8}
                            className="
                              h-12
                              w-10
                              items-center
                              justify-center
                              rounded-full
                              active:bg-udhaar-soft
                            "
                          >
                            <Ionicons
                              name="close"
                              size={21}
                              color="#D9544D"
                            />
                          </Pressable>
                        </View>

                        {matches.length > 0 ? (
                          <View className="overflow-hidden rounded-control border border-border bg-surface">
                            {matches.map(
                              (
                                item,
                                matchIndex
                              ) => (
                                <Pressable
                                  key={
                                    item.id
                                  }
                                  onPress={() =>
                                    handleSelectItem(
                                      draft.id,
                                      item
                                    )
                                  }
                                  className={`
                                    px-4
                                    py-3
                                    active:bg-chip
                                    ${
                                      matchIndex <
                                      matches.length -
                                        1
                                        ? 'border-b border-border'
                                        : ''
                                    }
                                  `}
                                >
                                  <AppText variant="body">
                                    {
                                      item.name
                                    }
                                  </AppText>
                                </Pressable>
                              )
                            )}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
              </View>
            ) : null}

            {/* Other item */}
            <Pressable
              onPress={handleAddItemRow}
              className="
                mt-4
                flex-row
                items-center
                self-start
                rounded-full
                bg-chip
                px-4
                py-2.5
                active:opacity-60
              "
            >
              <Ionicons
                name="add"
                size={18}
                color="#777770"
              />

              <AppText
                className="
                  ml-1
                  font-spline-medium
                  text-[16px]
                  text-muted
                "
              >
                Other
              </AppText>
            </Pressable>
          </View>
        </ScrollView>

        {/* Save */}
        <View className="border-t border-border bg-background pb-5 pt-3">
          <Button
            label={
              validAmount
                ? `Add Rs ${parsedAmount.toLocaleString()}`
                : 'Add Udhaar'
            }
            loading={saving}
            disabled={!validAmount}
            onPress={handleSave}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}