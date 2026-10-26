
import React from 'react';

import {
  ActivityIndicator,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { PartyList } from '@/components/party';
import { AppHeader } from '@/components/layout';

import {
  AppText,
  Button,
  ConfirmModal,
  EmptyState,
  Screen,
  SearchField,
} from '@/components/ui';

import { usePartyList } from '@/hooks/party/usePartyList';
import { useDeleteParty } from '@/hooks/party/useDeleteParty';
import { useShopIdentity } from '@/hooks/shop/useShopIdentity';

export default function SuppliersScreen() {
  const {
    parties,
    query,
    loading,
    refreshing,
    error,
    handleSearch,
    refresh,
  } = usePartyList('SUPPLIER');

  const {
    shopId,
    deviceId,
    loading: identityLoading,
    error: identityError,
  } = useShopIdentity();

  const {
    partyToDelete,
    deletingPartyId,
    deleteError,
    confirmDeleteParty,
    cancelDeleteParty,
    executeDeleteParty,
  } = useDeleteParty({
    shopId,
    deviceId,
    onDeleted: refresh,
  });

  function handleOpenSupplier(supplierId: string) {
    router.push({
      pathname: '/suppliers/[id]',
      params: {
        id: supplierId,
        from: 'suppliers',
      },
    });
  }

  function handleQuickSupply(supplierId: string) {
    router.push({
      pathname: '/suppliers/[id]/supply',
      params: {
        id: supplierId,
        from: 'suppliers',
      },
    });
  }

  function handleAddSupplier() {
    router.push('/suppliers/new');
  }

  const isSearching = query.trim().length > 0;

  if (loading || identityLoading) {
    return (
      <Screen>
        <AppHeader title="Suppliers" />

        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color="#242422"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Suppliers" />

      <View className="mb-4">
        <SearchField
          value={query}
          onChangeText={handleSearch}
          placeholder="Search suppliers"
        />
      </View>

      {error || identityError || deleteError ? (
        <View className="mb-4 rounded-control bg-udhaar-soft px-4 py-3">
          <AppText
            variant="small"
            className="text-udhaar"
          >
            {deleteError ?? identityError ?? error}
          </AppText>
        </View>
      ) : null}

      <PartyList
        partyType="SUPPLIER"
        parties={parties}
        deletingPartyId={deletingPartyId}
        onDeleteParty={confirmDeleteParty}
        refreshing={refreshing}
        onRefresh={() => {
          void refresh();
        }}
        onOpenParty={handleOpenSupplier}
        onQuickTransaction={handleQuickSupply}
        ListEmptyComponent={
          <EmptyState
            icon={
              isSearching
                ? 'search-outline'
                : 'business-outline'
            }
            title={
              isSearching
                ? 'No suppliers found'
                : 'No suppliers yet'
            }
            description={
              isSearching
                ? `No supplier matches "${query.trim()}".`
                : 'Add your first supplier to start recording supplies and payments.'
            }
          />
        }
      />

      <View className="pt-3">
        <Button
          label="Add Supplier"
          onPress={handleAddSupplier}
          left={
            <Ionicons
              name="add"
              size={21}
              color="#FFFFFF"
            />
          }
        />
      </View>

      <ConfirmModal
        visible={partyToDelete !== null}
        title="Delete supplier?"
        message={
          `Are you sure you want to delete ` +
          `${partyToDelete?.name ?? 'this supplier'}? ` +
          `This change will sync to your other devices.`
        }
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        loading={deletingPartyId !== null}
        onConfirm={() => {
          void executeDeleteParty();
        }}
        onCancel={cancelDeleteParty}
      />
    </Screen>
  );
}
