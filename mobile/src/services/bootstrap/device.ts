import {
  createBootstrap,
  joinBootstrap,
} from '@/api/bootstrapApi';
import { getDatabase } from '@/db/database';
import { DeviceRepository } from '@/repositories/device';
import { LocalIdentityRepository } from '@/repositories/local-identity';
import { ShopRepository } from '@/repositories/shop';
import type {
  Device,
  Shop,
} from '@/types/domain';

export interface CreateShopInput {
  shopName: string;
  deviceName: string;
}

export interface JoinShopInput {
  shopId: string;
  shopName: string;
  deviceName: string;
}

export interface BootstrapDeviceResult {
  shop: Shop;
  device: Device;
}

export class BootstrapDeviceService {
  constructor(
    private readonly shopRepository:
      ShopRepository,
    private readonly deviceRepository:
      DeviceRepository,
    private readonly localIdentityRepository:
      LocalIdentityRepository
  ) {}

  async createShop(
    input: CreateShopInput
  ): Promise<BootstrapDeviceResult> {
    const shopName =
      input.shopName.trim();

    const deviceName =
      input.deviceName.trim();

    if (!shopName) {
      throw new Error(
        'Shop name is required'
      );
    }

    if (!deviceName) {
      throw new Error(
        'Device name is required'
      );
    }

    await this.ensureInstallationIsFresh();

    const shopId =
      crypto.randomUUID();

    const deviceId =
      crypto.randomUUID();

    const remote =
      await createBootstrap({
        shopId,
        deviceId,
        shopName,
        deviceName,
      });

    if (
      remote.shop_id !== shopId ||
      remote.device_id !== deviceId
    ) {
      throw new Error(
        'Backend returned a different shop or device identity'
      );
    }

    const now =
      new Date().toISOString();

    const shop: Shop = {
      id: shopId,
      name: shopName,
      createdAt: now,
    };

    const device: Device = {
      id: deviceId,
      shopId,
      name: deviceName,
      lastSyncAt: null,
      createdAt: now,
    };

    await this.persistIdentity(
      shop,
      device
    );

    console.log(
      '[bootstrap] identity created',
      {
        shopId: shop.id,
        deviceId: device.id,
      }
    );

    return {
      shop,
      device,
    };
  }

  async joinShop(
    input: JoinShopInput
  ): Promise<BootstrapDeviceResult> {
    const shopId =
      input.shopId.trim();

    const shopName =
      input.shopName.trim();

    const deviceName =
      input.deviceName.trim();

    if (!shopId) {
      throw new Error(
        'Shop ID is required'
      );
    }

    if (!shopName) {
      throw new Error(
        'Shop name is required'
      );
    }

    if (!deviceName) {
      throw new Error(
        'Device name is required'
      );
    }

    await this.ensureInstallationIsFresh();

    const deviceId =
      crypto.randomUUID();

    const remote =
      await joinBootstrap({
        shopId,
        deviceId,
        deviceName,
      });

    if (
      remote.shop_id !== shopId ||
      remote.device_id !== deviceId
    ) {
      throw new Error(
        'Backend returned a different shop or device identity'
      );
    }

    const now =
      new Date().toISOString();

    const shop: Shop = {
      id: shopId,
      name: shopName,
      createdAt: now,
    };

    const device: Device = {
      id: deviceId,
      shopId,
      name: deviceName,
      lastSyncAt: null,
      createdAt: now,
    };

    await this.persistIdentity(
      shop,
      device
    );

    console.log(
      '[bootstrap] identity joined',
      {
        shopId: shop.id,
        deviceId: device.id,
      }
    );

    return {
      shop,
      device,
    };
  }

  private async ensureInstallationIsFresh():
    Promise<void> {
    const existingIdentity =
      await this.localIdentityRepository.get();

    if (existingIdentity) {
      throw new Error(
        'This installation is already configured'
      );
    }

    /*
     * Defensive check for databases created before
     * local_identity existed.
     *
     * We must not silently attach a new identity to
     * an existing local shop.
     */
    const existingShop =
      await this.shopRepository.getFirst();

    if (existingShop) {
      throw new Error(
        'This installation contains legacy identity data. Clear local data before configuring it again.'
      );
    }
  }

  private async persistIdentity(
    shop: Shop,
    device: Device
  ): Promise<void> {
    const db =
      await getDatabase();

    await db.withTransactionAsync(
      async () => {
        await this.shopRepository
          .createWithDatabase(
            db,
            {
              id: shop.id,
              name: shop.name,
              createdAt:
                shop.createdAt,
            }
          );

        await this.deviceRepository
          .createWithDatabase(
            db,
            {
              id: device.id,
              shopId:
                device.shopId,
              name: device.name,
              createdAt:
                device.createdAt,
            }
          );

        await this.localIdentityRepository
          .createWithDatabase(
            db,
            {
              shopId: shop.id,
              deviceId: device.id,
              createdAt:
                device.createdAt,
            }
          );
      }
    );
  }
}