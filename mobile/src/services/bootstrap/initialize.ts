import { DeviceRepository } from '@/repositories/device';
import { LocalIdentityRepository } from '@/repositories/local-identity';
import { ShopRepository } from '@/repositories/shop';
import type { Device, Shop } from '@/types/domain';

export interface AppIdentity {
  shop: Shop;
  device: Device;
}

export class InitializeAppService {
  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly deviceRepository: DeviceRepository,
    private readonly localIdentityRepository: LocalIdentityRepository
  ) {}

  async execute(): Promise<AppIdentity | null> {
    const localIdentity =
      await this.localIdentityRepository.get();

    if (!localIdentity) {
      console.log(
        'No local installation identity found'
      );

      return null;
    }

    const shop =
      await this.shopRepository.getById(
        localIdentity.shopId
      );

    if (!shop) {
      console.error(
        'Local identity references missing shop',
        {
          shopId: localIdentity.shopId,
          deviceId: localIdentity.deviceId,
        }
      );

      return null;
    }

    const device =
      await this.deviceRepository.getById(
        localIdentity.deviceId
      );

    if (!device) {
      console.error(
        'Local identity references missing device',
        {
          shopId: localIdentity.shopId,
          deviceId: localIdentity.deviceId,
        }
      );

      return null;
    }

    if (device.shopId !== shop.id) {
      console.error(
        'Local device belongs to a different shop',
        {
          shopId: shop.id,
          deviceId: device.id,
          deviceShopId: device.shopId,
        }
      );

      return null;
    }

    console.log(
      'Existing Simple Khata identity:',
      {
        shopId: shop.id,
        shopName: shop.name,
        deviceId: device.id,
        deviceName: device.name,
      }
    );

    return {
      shop,
      device,
    };
  }
}