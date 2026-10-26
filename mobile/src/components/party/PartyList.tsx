
import React, {
  useCallback,
  useState,
} from 'react';

import {
  FlatList,
  type FlatListProps,
  type ListRenderItem,
} from 'react-native';

import {
  PartyRow,
  type PartyRowData,
  type PartyRowType,
} from './PartyRow';

export interface PartyListProps<
  T extends PartyRowData = PartyRowData
> extends Omit<
  FlatListProps<T>,
  'data' | 'renderItem' | 'keyExtractor'
> {
  parties: T[];
  partyType?: PartyRowType;

  deletingPartyId?: string | null;

  onOpenParty: (
    id: string,
    type: PartyRowType
  ) => void;

  onQuickTransaction: (
    id: string,
    type: PartyRowType
  ) => void;

  onDeleteParty?: (
    party: T
  ) => void | Promise<void>;
}

export function PartyList<
  T extends PartyRowData = PartyRowData
>({
  parties,
  partyType,
  deletingPartyId = null,
  onOpenParty,
  onQuickTransaction,
  onDeleteParty,
  ...flatListProps
}: PartyListProps<T>) {
  const [selectedPartyId, setSelectedPartyId] =
    useState<string | null>(null);

  /*
   * Long-press toggles selection.
   * Selection exposes the delete button.
   */
  const handleSelectParty = useCallback(
    (partyId: string) => {
      setSelectedPartyId((current) =>
        current === partyId ? null : partyId
      );
    },
    []
  );

  const renderItem = useCallback<ListRenderItem<T>>(
    ({ item, index }) => {
      const type = partyType ?? item.type;

      return (
        <PartyRow
          party={{
            ...item,
            type,
          }}
          first={index === 0}
          last={index === parties.length - 1}
          selected={selectedPartyId === item.id}
          isDeleting={deletingPartyId === item.id}
          onOpenParty={() => {
            onOpenParty(item.id, type);
          }}
          onLongPressParty={
            onDeleteParty
              ? () => {
                  handleSelectParty(item.id);
                }
              : undefined
          }
          onQuickTransaction={() => {
            onQuickTransaction(item.id, type);
          }}
          onDelete={
            onDeleteParty
              ? () => {
                  void onDeleteParty(item);
                }
              : undefined
          }
        />
      );
    },
    [
      parties.length,
      partyType,
      selectedPartyId,
      deletingPartyId,
      onOpenParty,
      handleSelectParty,
      onQuickTransaction,
      onDeleteParty,
    ]
  );

  return (
    <FlatList
      {...flatListProps}
      data={parties}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    />
  );
}
