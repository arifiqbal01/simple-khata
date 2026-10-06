export const BOOTSTRAP_IDENTITY = {
  shop: {
    id: '01c60556-1937-4953-b896-f2ae39dcca7b',
    name: 'Iqbal Kiryana Store',
  },

  devices: {
    iqbal: {
      id: 'IQBAL-DEVICE-UUID',
      name: 'Iqbal',
    },

    arif: {
      id: '8efcba85-5d46-42a1-8b13-d378d10faa97',
      name: 'Arif',
    },
  },
} as const;

export type BootstrapDeviceKey =
  keyof typeof BOOTSTRAP_IDENTITY.devices;