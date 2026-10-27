
import React, {
  useCallback,
  useEffect,
  useMemo,
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

  /**
   * Optional display limit.
   *
   * Home: maxItems={10}
   * Customer/Supplier pages: omit this prop.
   *
   * For efficient loading, the repository should
   * also limit the number of records fetched.
   */
  maxItems?: number;

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
  maxItems,
  deletingPartyId = null,
  onOpenParty,
  onQuickTransaction,
  onDeleteParty,
  ...flatListProps
}: PartyListProps<T>) {
  const [selectedPartyId, setSelectedPartyId] =
    useState<string | null>(null);

  const visibleParties = useMemo(() => {
    if (maxItems === undefined) {
      return parties;
    }

    const limit = Number.isFinite(maxItems)
      ? Math.max(0, Math.floor(maxItems))
      : parties.length;

    return parties.slice(0, limit);
  }, [parties, maxItems]);

  // Clear selection when the selected party
  // disappears from the current page.
  useEffect(() => {
    if (
      selectedPartyId !== null &&
      !visibleParties.some(
        (party) => party.id === selectedPartyId
      )
    ) {
      setSelectedPartyId(null);
    }
  }, [selectedPartyId, visibleParties]);

  const handleSelectParty = useCallback(
    (partyId: string) => {
      setSelectedPartyId((current) =>
        current === partyId ? null : partyId
      );
    },
    []
  );

  const handleOpenParty = useCallback(
    (id: string, type: PartyRowType) => {
      setSelectedPartyId(null);
      onOpenParty(id, type);
    },
    [onOpenParty]
  );

  const handleQuickTransaction = useCallback(
    (id: string, type: PartyRowType) => {
      setSelectedPartyId(null);
      onQuickTransaction(id, type);
    },
    [onQuickTransaction]
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
          last={index === visibleParties.length - 1}
          selected={selectedPartyId === item.id}
          isDeleting={deletingPartyId === item.id}
          onOpenParty={() =>
            handleOpenParty(item.id, type)
          }
          onLongPressParty={
            onDeleteParty
              ? () => handleSelectParty(item.id)
              : undefined
          }
          onQuickTransaction={() =>
            handleQuickTransaction(item.id, type)
          }
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
      partyType,
      visibleParties.length,
      selectedPartyId,
      deletingPartyId,
      handleOpenParty,
      handleSelectParty,
      handleQuickTransaction,
      onDeleteParty,
    ]
  );

  return (
    <FlatList
      {...flatListProps}
      data={visibleParties}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews={false}
      extraData={selectedPartyId}
    />
  );
}
