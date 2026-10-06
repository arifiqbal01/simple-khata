import { DeviceRepository } from '@/repositories/device';
import { ShopRepository } from '@/repositories/shop';
import type { Device, Shop } from '@/types/domain';

export interface AppIdentity {
  shop: Shop;
  device: Device;
}

export class InitializeAppService {
  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly deviceRepository: DeviceRepository
  ) {}

  async execute(): Promise<AppIdentity | null> {
    const shop =
      await this.shopRepository.getFirst();

    if (!shop) {
      console.log('No existing shop found');
      return null;
    }

    const device =
      await this.deviceRepository.getFirstByShop(
        shop.id
      );

    if (!device) {
      console.log('No existing device found', {
        shopId: shop.id,
        shopName: shop.name,
      });

      return null;
    }

    console.log('Existing Simple Khata identity:', {
      shopId: shop.id,
      shopName: shop.name,
      deviceId: device.id,
      deviceName: device.name,
    });

    return {
      shop,
      device,
    };
  }
}