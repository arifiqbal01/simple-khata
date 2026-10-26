
import {
  memo,
  useMemo,
  useState,
} from 'react';

import {
  Keyboard,
  Pressable,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  AppText,
  TextField,
} from '@/components/ui';

import type { Item } from '@/types/domain';

import type {
  DraftUdhaarItem,
} from '@/hooks/ledger/useAddUdhaar';

interface ItemSearchFieldsProps {
  drafts: DraftUdhaarItem[];
  availableItems: Item[];
  selectedItemIds: string[];

  onChangeName: (id: string, name: string) => void;
  onSelectItem: (draftId: string, item: Item) => void;
  onConfirm: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onFocusField?: () => void;
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export const ItemSearchFields = memo(
  function ItemSearchFields({
    drafts,
    availableItems,
    selectedItemIds,
    onChangeName,
    onSelectItem,
    onConfirm,
    onRemove,
    onAdd,
    onFocusField,
  }: ItemSearchFieldsProps) {
    const [focusedId, setFocusedId] =
      useState<string | null>(null);

    const selectedSet = useMemo(
      () => new Set(selectedItemIds),
      [selectedItemIds]
    );

    function selectSuggestion(
      draftId: string,
      item: Item
    ) {
      onSelectItem(draftId, item);
      setFocusedId(null);
      Keyboard.dismiss();
    }

    function confirmDraft(draftId: string) {
      onConfirm(draftId);
      setFocusedId(null);
      Keyboard.dismiss();
    }

    function removeDraft(draftId: string) {
      onRemove(draftId);
      setFocusedId(null);
    }

    return (
      <View className="mt-5">
        <View className="gap-4">
          {drafts.map((draft) => {
            const name = draft.name.trim();
            const query = normalizeName(name);

            const matches =
              focusedId === draft.id &&
              query.length > 0
                ? availableItems
                    .filter(
                      (item) =>
                        normalizeName(item.name).includes(
                          query
                        ) &&
                        !selectedSet.has(item.id)
                    )
                    .slice(0, 5)
                : [];

            const exactCatalogItem =
              availableItems.find(
                (item) =>
                  normalizeName(item.name) === query
              );

            const canConfirm = query.length > 0;

            const isNewItem =
              canConfirm && !exactCatalogItem;

            return (
              <View
                key={draft.id}
                className="gap-2"
              >
                <View className="flex-row items-center gap-2">
                  <TextField
                    value={draft.name}
                    onChangeText={(value) =>
                      onChangeName(draft.id, value)
                    }
                    onFocus={() => {
                      setFocusedId(draft.id);
                      onFocusField?.();
                    }}
                    placeholder="Search or enter item"
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (canConfirm) {
                        if (exactCatalogItem) {
                          selectSuggestion(
                            draft.id,
                            exactCatalogItem
                          );
                        } else {
                          confirmDraft(draft.id);
                        }
                      }
                    }}
                    className="flex-1"
                  />

                  <Pressable
                    onPress={() =>
                      removeDraft(draft.id)
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Remove item field"
                    hitSlop={8}
                    className="h-12 w-9 items-center justify-center rounded-xl"
                  >
                    <Ionicons
                      name="close"
                      size={21}
                      color="#D9544D"
                    />
                  </Pressable>
                </View>

                {matches.length > 0 ? (
                  <View className="overflow-hidden rounded-xl border border-border bg-surface">
                    {matches.map((item, index) => (
                      <Pressable
                        key={item.id}
                        onPress={() =>
                          selectSuggestion(
                            draft.id,
                            item
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${item.name}`}
                        className={`flex-row items-center justify-between px-4 py-3 ${
                          index < matches.length - 1
                            ? 'border-b border-border'
                            : ''
                        }`}
                      >
                        <View className="min-w-0 flex-1">
                          <AppText className="text-[15px] text-foreground">
                            {item.name}
                          </AppText>

                          {item.default_unit ? (
                            <AppText className="mt-1 text-[12px] text-muted">
                              {item.default_unit}
                              {item.default_selling_price != null
                                ? ` · Rs ${item.default_selling_price}`
                                : ''}
                            </AppText>
                          ) : null}
                        </View>

                        <Ionicons
                          name="add-circle-outline"
                          size={20}
                          color="#777770"
                        />
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {isNewItem ? (
                  <Pressable
                    onPress={() =>
                      confirmDraft(draft.id)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Add new item ${name}`}
                    className="flex-row items-center rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={21}
                      color="#242422"
                    />

                    <View className="ml-3 flex-1">
                      <AppText className="font-spline-medium text-[14px] text-foreground">
                        Add new item
                      </AppText>

                      <AppText
                        numberOfLines={1}
                        className="mt-1 text-[12px] text-muted"
                      >
                        {name}
                      </AppText>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={17}
                      color="#777770"
                    />
                  </Pressable>
                ) : null}

                {canConfirm && exactCatalogItem ? (
                  <Pressable
                    onPress={() =>
                      selectSuggestion(
                        draft.id,
                        exactCatalogItem
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${exactCatalogItem.name}`}
                    className="flex-row items-center self-start rounded-xl bg-[#242422] px-4 py-3"
                  >
                    <Ionicons
                      name="checkmark"
                      size={17}
                      color="#FFFFFF"
                    />

                    <AppText className="ml-2 font-spline-semibold text-[13px] text-white">
                      Select item
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Add another item"
          className="mt-5 flex-row items-center self-start rounded-xl border border-border bg-surface px-4 py-3"
        >
          <Ionicons
            name="add"
            size={19}
            color="#242422"
          />

          <AppText className="ml-2 font-spline-medium text-[14px] text-foreground">
            Add another item
          </AppText>
        </Pressable>
      </View>
    );
  }
);
