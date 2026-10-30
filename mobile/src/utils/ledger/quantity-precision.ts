export const MAX_QUANTITY = 999_999_999.999;

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

  // Quantities must be representable to 3 decimal places.
  // Use a small tolerance for JavaScript floating-point arithmetic.
  const scaled = quantity * 1000;

  return (
    Math.abs(scaled - Math.round(scaled)) < 1e-7
  );
}



export function repairLegacyQuantity(
  value: unknown
): number | null {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  const rounded = Number(value.toFixed(3));

  if (
    rounded <= 0 ||
    rounded > 999_999_999.999
  ) {
    return null;
  }

  return rounded;
}