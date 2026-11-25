// The size table: which optional columns a product needs, and the one fit note the numbers themselves support.
// Pure functions with no astro:* imports, so Node runs them in tests.

import { formatNumber } from './format.ts';

export interface SizeRow {
  size: string;
  /** Chest width with the liner out, in cm. */
  chest: number;
  /** Chest width with the liner zipped in, in cm. */
  chestWithLiner?: number | undefined;
  back: number;
  sleeve?: number | undefined;
}

export interface SizeColumns {
  chestWithLiner: boolean;
  sleeve: boolean;
}

/** An optional column is shown when at least one size has a value for it. */
export function sizeColumns(rows: readonly SizeRow[]): SizeColumns {
  return {
    chestWithLiner: rows.some((row) => row.chestWithLiner !== undefined),
    sleeve: rows.some((row) => row.sleeve !== undefined),
  };
}

const roundTenth = (value: number) => Math.round(value * 10) / 10;

/**
 * How much narrower the jacket gets inside with the liner in, read from the table, e.g. „o 2 cm” or „o 2–3 cm”.
 * Null unless every size has both chest widths and the liner makes each one narrower: the note never claims
 * more than the table shows.
 */
export function linerFitNote(rows: readonly SizeRow[]): string | null {
  if (rows.length === 0 || rows.some((row) => row.chestWithLiner === undefined)) return null;
  const differences = rows.map((row) => roundTenth(row.chest - row.chestWithLiner!));
  const least = Math.min(...differences);
  const most = Math.max(...differences);
  if (least <= 0) return null;
  const amount = least === most ? formatNumber(least) : `${formatNumber(least)}–${formatNumber(most)}`;
  return `Z wpiętą podpinką kurtka będzie w środku o ${amount} cm węższa.`;
}
