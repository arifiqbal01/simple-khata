
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
    const [focusedId, setFocusedId] = useState<
      string | null
    >(null);

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
            const query = draft.name
              .trim()
              .toLocaleLowerCase();

            const matches =
              focusedId === draft.id &&
              query.length > 0
                ? availableItems
                    .filter(
                      (item) =>
                        item.name
                          .toLocaleLowerCase()
                          .includes(query) &&
                        !selectedSet.has(item.id)
                    )
                    .slice(0, 5)
                : [];

            const canConfirm = query.length > 0;

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
                        confirmDraft(draft.id);
                      }
                    }}
                    className="flex-1"
                  />

                  {canConfirm ? (
                    <Pressable
                      onPress={() =>
                        confirmDraft(draft.id)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${draft.name}`}
                      className="h-12 items-center justify-center rounded-xl bg-[#242422] px-3"
                    >
                      <AppText className="font-spline-semibold text-[13px] text-white">
                        Done
                      </AppText>
                    </Pressable>
                  ) : null}

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
                        <AppText className="flex-1 text-[15px] text-foreground">
                          {item.name}
                        </AppText>

                        <Ionicons
                          name="add-circle-outline"
                          size={20}
                          color="#777770"
                        />
                      </Pressable>
                    ))}
                  </View>
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
