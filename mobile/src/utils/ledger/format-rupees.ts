
/**
 * Format whole Pakistani rupee amounts with
 * comma thousands separators.
 *
 * Examples:
 * 4140  -> 4,140
 * 3695  -> 3,695
 * -270  -> -270
 */
export function formatRupees(amount: number): string {
  const sign = amount < 0 ? '-' : '';

  const digits = Math.abs(Math.trunc(amount)).toString();

  return sign + digits.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ','
  );
}
