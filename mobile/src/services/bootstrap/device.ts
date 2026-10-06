import { getDatabase } from '@/db/database';
import { DeviceRepository } from '@/repositories/device';
import { ShopRepository } from '@/repositories/shop';
import type { Device, Shop } from '@/types/domain';

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
    private readonly shopRepository: ShopRepository,
    private readonly deviceRepository: DeviceRepository
  ) {}

  async createShop(
    input: CreateShopInput
  ): Promise<BootstrapDeviceResult> {
    const shopName = input.shopName.trim();
    const deviceName = input.deviceName.trim();

    if (!shopName) {
      throw new Error('Shop name is required');
    }

    if (!deviceName) {
      throw new Error('Device name is required');
    }

    await this.ensureInstallationIsFresh();

    const now = new Date().toISOString();

    const shop: Shop = {
      id: crypto.randomUUID(),
      name: shopName,
      createdAt: now,
    };

    const device: Device = {
      id: crypto.randomUUID(),
      shopId: shop.id,
      name: deviceName,
      lastSyncAt: null,
      createdAt: now,
    };

    await this.persistIdentity(shop, device);

    return {
      shop,
      device,
    };
  }

  async joinShop(
    input: JoinShopInput
  ): Promise<BootstrapDeviceResult> {
    const shopId = input.shopId.trim();
    const shopName = input.shopName.trim();
    const deviceName = input.deviceName.trim();

    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    if (!shopName) {
      throw new Error('Shop name is required');
    }

    if (!deviceName) {
      throw new Error('Device name is required');
    }

    await this.ensureInstallationIsFresh();

    const now = new Date().toISOString();

    const shop: Shop = {
      id: shopId,
      name: shopName,
      createdAt: now,
    };

    const device: Device = {
      id: crypto.randomUUID(),
      shopId,
      name: deviceName,
      lastSyncAt: null,
      createdAt: now,
    };

    await this.persistIdentity(shop, device);

    return {
      shop,
      device,
    };
  }

  private async ensureInstallationIsFresh() {
    const existingShop =
      await this.shopRepository.getFirst();

    if (existingShop) {
      throw new Error(
        'This installation is already configured'
      );
    }
  }

  private async persistIdentity(
    shop: Shop,
    device: Device
  ): Promise<void> {
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await this.shopRepository.createWithDatabase(
        db,
        {
          id: shop.id,
          name: shop.name,
          createdAt: shop.createdAt,
        }
      );

      await this.deviceRepository.createWithDatabase(
        db,
        {
          id: device.id,
          shopId: device.shopId,
          name: device.name,
          createdAt: device.createdAt,
        }
      );
    });
  }
}