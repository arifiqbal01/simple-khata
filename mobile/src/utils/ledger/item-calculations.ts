
/**
 * Shared item calculations for Customer Udhaar
 * and Supplier Supply.
 *
 * Financial rules:
 * - Amounts and unit prices use whole rupees.
 * - Quantities support up to 3 decimal places.
 * - Amount-first preserves the entered amount.
 * - Quantity-first rounds each line total once.
 * - Derived quantities are approximate.
 *
 * These functions do not modify stored records.
 */

const QUANTITY_DECIMAL_PLACES = 3;
const QUANTITY_SCALE = 1000;

// Maximum supported by Decimal(max_digits=12,
// decimal_places=3) on the backend.
const MAX_QUANTITY = 999_999_999.999;

/**
 * Parse a non-negative whole-rupee amount.
 *
 * Returns null for invalid input.
 * Callers must separately require > 0 when needed.
 */
export function parseWholeRupees(
  value: string
): number | null {
  const text = value.trim();

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const amount = Number(text);

  return Number.isSafeInteger(amount) && amount >= 0
    ? amount
    : null;
}

/**
 * Parse a positive quantity with at most
 * 3 significant fractional decimal places.
 *
 * Trailing zeros are allowed:
 * 1.2500 -> 1.25
 */
export function parseQuantity(
  value: string
): number | null {
  const text = value.trim();

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
    return null;
  }

  const quantity = Number(text);

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > MAX_QUANTITY
  ) {
    return null;
  }

  const fractionalPart = text.split('.')[1] ?? '';

  if (
    fractionalPart.replace(/0+$/, '').length >
    QUANTITY_DECIMAL_PLACES
  ) {
    return null;
  }

  return quantity;
}

/**
 * Unit prices are non-negative whole rupees.
 */
export function parseUnitPrice(
  value: string
): number | null {
  return parseWholeRupees(value);
}

/**
 * Quantity-first calculation.
 *
 * Calculates a line amount and rounds it
 * once to whole rupees.
 */

export function calculateAmount(
  quantityText: string,
  unitPriceText: string
): number | null {
  const quantity = parseQuantity(quantityText);
  const unitPrice = parseUnitPrice(unitPriceText);

  if (quantity === null || unitPrice === null) {
    return null;
  }

  const quantityThousandths = Math.round(
    quantity * QUANTITY_SCALE
  );

  if (!Number.isSafeInteger(quantityThousandths)) {
    return null;
  }

  const totalThousandths =
    quantityThousandths * unitPrice;

  if (!Number.isSafeInteger(totalThousandths)) {
    return null;
  }

  const rounded = Math.round(
    totalThousandths / QUANTITY_SCALE
  );

  return Number.isSafeInteger(rounded)
    ? rounded
    : null;
}


/**
 * Amount-first calculation.
 *
 * Derives an approximate quantity from an
 * authoritative whole-rupee amount.
 *
 * Example:
 * 17000 / 145 -> 117.241
 *
 * The original amount must not be recalculated
 * from this approximate quantity.
 */
export function calculateQuantity(
  amountText: string,
  unitPriceText: string
): number | null {
  const amount = parseWholeRupees(amountText);
  const unitPrice = parseUnitPrice(unitPriceText);

  if (
    amount === null ||
    unitPrice === null ||
    unitPrice <= 0
  ) {
    return null;
  }

  const quantity = amount / unitPrice;

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > MAX_QUANTITY
  ) {
    return null;
  }

  const roundedQuantity =
    Math.round(quantity * QUANTITY_SCALE) /
    QUANTITY_SCALE;

  if (
    roundedQuantity <= 0 ||
    roundedQuantity > MAX_QUANTITY
  ) {
    return null;
  }

  return roundedQuantity;
}

/**
 * Format a calculated quantity for display.
 *
 * Examples:
 * 117.241 -> "117.241"
 * 2.500   -> "2.5"
 * 3.000   -> "3"
 */

export function formatCalculatedQuantity(
  quantity: number,
  decimalPlaces = QUANTITY_DECIMAL_PLACES
): string {
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > MAX_QUANTITY
  ) {
    return '';
  }

  const places = Math.max(
    0,
    Math.min(
      QUANTITY_DECIMAL_PLACES,
      Math.trunc(decimalPlaces)
    )
  );

  const formatted = quantity.toFixed(places);

  if (places === 0) {
    return formatted;
  }

  return formatted
    .replace(/0+$/, '')
    .replace(/\.$/, '');
}

