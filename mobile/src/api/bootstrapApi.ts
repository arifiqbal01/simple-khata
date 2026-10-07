import { env } from '@/config/env';

export interface CreateBootstrapInput {
  shopId: string;
  deviceId: string;
  shopName: string;
  deviceName: string;
}

export interface JoinBootstrapInput {
  shopId: string;
  deviceId: string;
  deviceName: string;
}

export interface BootstrapResponse {
  shop_id: string;
  device_id: string;
}

export async function createBootstrap(
  input: CreateBootstrapInput
): Promise<BootstrapResponse> {
  const response = await fetch(
    `${env.apiUrl}/bootstrap`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shop_id: input.shopId,
        device_id: input.deviceId,
        shop_name: input.shopName,
        device_name: input.deviceName,
      }),
    }
  );

  if (!response.ok) {
    const message =
      await readErrorMessage(response);

    throw new Error(
      `Bootstrap failed (${response.status}): ${message}`
    );
  }

  return response.json();
}

export async function joinBootstrap(
  input: JoinBootstrapInput
): Promise<BootstrapResponse> {
  const response = await fetch(
    `${env.apiUrl}/bootstrap/join`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shop_id: input.shopId,
        device_id: input.deviceId,
        device_name: input.deviceName,
      }),
    }
  );

  if (!response.ok) {
    const message =
      await readErrorMessage(response);

    throw new Error(
      `Bootstrap join failed (${response.status}): ${message}`
    );
  }

  return response.json();
}

async function readErrorMessage(
  response: Response
): Promise<string> {
  try {
    const data: unknown =
      await response.json();

    if (
      typeof data === 'object' &&
      data !== null &&
      'detail' in data
    ) {
      const detail = (
        data as {
          detail?: unknown;
        }
      ).detail;

      if (typeof detail === 'string') {
        return detail;
      }

      if (detail !== undefined) {
        return JSON.stringify(detail);
      }
    }
  } catch {
    // Use HTTP status text below.
  }

  return (
    response.statusText ||
    'Unknown bootstrap error'
  );
}