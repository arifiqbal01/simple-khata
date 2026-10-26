
import React, { useCallback } from 'react';

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

export default function CustomersScreen() {
  const {
    parties,
    query,
    loading,
    refreshing,
    error,
    handleSearch,
    refresh,
  } = usePartyList('CUSTOMER');

  const {
    shopId,
    deviceId,
    loading: identityLoading,
    error: identityError,
  } = useShopIdentity();

  const onDeleted = useCallback(async () => {
    await refresh();
  }, [refresh]);

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
    onDeleted,
  });

  const handleQuickUdhaar = useCallback(
    (partyId: string) => {
      router.push({
        pathname: '/customer/[id]/udhaar',
        params: {
          id: partyId,
          from: 'customers',
        },
      });
    },
    []
  );

  const handleOpenCustomer = useCallback(
    (partyId: string) => {
      router.push({
        pathname: '/customer/[id]',
        params: {
          id: partyId,
          from: 'customers',
        },
      });
    },
    []
  );

  const handleAddCustomer = useCallback(() => {
    router.push({
      pathname: '/customer/new',
      params: {
        from: 'customers',
      },
    });
  }, []);

  const isSearching = query.trim().length > 0;

  if (loading || identityLoading) {
    return (
      <Screen>
        <AppHeader title="Customers" />

        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Customers" />

      <View className="mb-4">
        <SearchField
          value={query}
          onChangeText={handleSearch}
          placeholder="Search customers"
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
        partyType="CUSTOMER"
        parties={parties}
        deletingPartyId={deletingPartyId}
        onDeleteParty={confirmDeleteParty}
        refreshing={refreshing}
        onRefresh={refresh}
        onQuickTransaction={handleQuickUdhaar}
        onOpenParty={handleOpenCustomer}
        ListEmptyComponent={
          <EmptyState
            icon={
              isSearching
                ? 'search-outline'
                : 'people-outline'
            }
            title={
              isSearching
                ? 'No customers found'
                : 'No customers yet'
            }
            description={
              isSearching
                ? `No customer matches "${query.trim()}".`
                : 'Add your first customer to start recording udhaar and payments.'
            }
          />
        }
      />

      <View className="pt-3">
        <Button
          label="Add Customer"
          onPress={handleAddCustomer}
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
        title="Delete customer?"
        message={
          `Are you sure you want to delete ` +
          `${partyToDelete?.name ?? 'this customer'}? ` +
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
