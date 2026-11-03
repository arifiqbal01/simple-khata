
export const MAX_QUANTITY = 999_999_999.999;

const QUANTITY_SCALE = 1000;
const QUANTITY_TOLERANCE = 1e-7;

export function isValidSyncQuantity(
  quantity: number
): boolean {
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > MAX_QUANTITY
  ) {
    return false;
  }

  const scaled = quantity * QUANTITY_SCALE;

  return (
    Math.abs(scaled - Math.round(scaled)) <
    QUANTITY_TOLERANCE
  );
}

/**
 * Convert an already-valid quantity into a canonical
 * decimal string with no more than 3 fractional digits.
 *
 * Never use this to silently repair an arbitrary
 * historical quantity.
 */
export function toSyncQuantityString(
  quantity: number
): string {
  if (!isValidSyncQuantity(quantity)) {
    throw new Error(
      'Quantity must be positive, within the supported range, ' +
      'and representable to at most 3 decimal places'
    );
  }

  const normalized = Number(quantity.toFixed(3));

  if (!isValidSyncQuantity(normalized)) {
    throw new Error('Invalid normalized quantity');
  }

  return String(normalized);
}

/**
 * Conservative legacy repair.
 *
 * Only accept quantities already within floating-point
 * tolerance of an exact 3-decimal value.
 */
export function repairLegacyQuantity(
  value: unknown
): number | null {
  if (
    typeof value !== 'number' ||
    !isValidSyncQuantity(value)
  ) {
    return null;
  }

  const repaired = Number(value.toFixed(3));

  return isValidSyncQuantity(repaired)
    ? repaired
    : null;
}
