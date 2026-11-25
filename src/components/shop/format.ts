// Text the shop templates print from product data: prices, measurements, temperatures and the fixed labels.
// Pure functions with no astro:* imports, so Node runs them in tests.

export type Liner = 'included' | 'compatible' | 'liner';
export type LinerState = 'in' | 'out';

const NBSP = '\u00a0';

/** Every AI image carries this label on the site (research §5, ADR 0001 §3). */
export const AI_LABEL = 'Wizualizacja AI';

/** What the product means for the liner, in the catalogue and on the product page. */
export const LINER_LABEL: Record<Liner, string> = {
  included: 'Podpinka zimowa w zestawie',
  compatible: 'Będzie pasować każda podpinka MONSUN w tym samym rozmiarze',
  liner: 'Do wszystkich kurtek MONSUN',
};

/** The two photo states of the liner toggle. */
export const STATE_LABEL: Record<LinerState, string> = {
  in: 'Z podpinką',
  out: 'Bez podpinki',
};

/**
 * A whole-złoty price as Polish shops print it: thousands grouped with a no-break space, and a no-break space
 * before „zł”, so the price never wraps. Intl's pl-PL leaves four-digit numbers ungrouped (1099), which reads
 * differently from the copy elsewhere on the site („1 099 zł”).
 */
export function formatPln(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError(`A price must be a whole, non-negative number of złoty, got ${amount}`);
  }
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)}${NBSP}zł`;
}

const decimal = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1, useGrouping: false });

/** A measurement with a decimal comma and at most one decimal place: 52, 52,5. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError(`Not a number: ${value}`);
  return decimal.format(value);
}

/** A temperature as the site prints it: „−10°C” with a true minus sign, „0°C”, „+15°C”. */
export function formatCelsius(value: number): string {
  const sign = value < 0 ? '\u2212' : value > 0 ? '+' : '';
  return `${sign}${formatNumber(Math.abs(value))}°C`;
}
