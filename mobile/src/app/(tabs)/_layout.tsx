
import { Redirect, Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  View,
} from 'react-native';

import { BottomNavigation } from '@/components/layout';

import { DeviceRepository } from '@/repositories/bootstrap/device';
import { LocalIdentityRepository } from '@/repositories/bootstrap/local-identity';
import { ShopRepository } from '@/repositories/bootstrap/shop';

import { InitializeAppService } from '@/services/bootstrap/initialize';

export default function TabsLayout() {
  const [ready, setReady] = useState(false);
  const [hasIdentity, setHasIdentity] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const service = new InitializeAppService(
          new ShopRepository(),
          new DeviceRepository(),
          new LocalIdentityRepository()
        );

        const identity = await service.execute();

        if (cancelled) {
          return;
        }

        setHasIdentity(identity !== null);
      } catch (error) {
        console.error(
          '[tabs] Failed to initialize app:',
          error
        );

        if (!cancelled) {
          setHasIdentity(false);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <StatusBar
          style="dark"
          backgroundColor="#F8F8F6"
          translucent={false}
        />

        <ActivityIndicator
          size="large"
          color="#242422"
        />
      </View>
    );
  }

  if (!hasIdentity) {
    return <Redirect href="/bootstrap" />;
  }

  return (
    <>
      <StatusBar
        style="dark"
        backgroundColor="#F8F8F6"
        translucent={false}
      />

      <Tabs
        tabBar={(props) => (
          <BottomNavigation {...props} />
        )}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
          }}
        />

        <Tabs.Screen
          name="customer"
          options={{
            title: 'Customers',
            popToTopOnBlur: true,
          }}
        />

        <Tabs.Screen
          name="suppliers"
          options={{
            title: 'Suppliers',
            popToTopOnBlur: true,
          }}
        />

        <Tabs.Screen
          name="items"
          options={{
            title: 'Items',
            popToTopOnBlur: true,
          }}
        />
      </Tabs>
    </>
  );
}
