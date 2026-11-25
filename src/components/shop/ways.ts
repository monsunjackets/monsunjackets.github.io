// Geometry of the „three ways” scale on /podpinka/: each way is a bar on one temperature axis.
//
// The scale is a table with one column per degree, and each bar is a cell whose colspan covers its range. That
// places the bars from data without style attributes, which the CSP forbids (ADR 0001 §4, §9).
// The axis runs from the lowest `fromC` rounded down to a multiple of `step` to the highest `toC` rounded up.
// Pure functions with no astro:* imports, so Node runs them in tests.

export interface Way {
  name: string;
  fromC: number;
  toC: number;
  months: string;
  note?: string | undefined;
}

export interface ScaleRow<W extends Way = Way> {
  way: W;
  /** Empty columns before the bar; 0 means none. */
  lead: number;
  /** Columns the bar covers, at least 1. */
  span: number;
  /** Empty columns after the bar; 0 means none. */
  tail: number;
}

export interface Scale<W extends Way = Way> {
  /** Temperature at the left edge of the axis. */
  min: number;
  /** Temperature at the right edge of the axis. */
  max: number;
  /** Number of one-degree columns, max − min. */
  columns: number;
  /** Labelled ticks, one every `step` degrees from min; each tick label spans `step` columns. */
  ticks: number[];
  rows: ScaleRow<W>[];
}

export function waysScale<W extends Way>(ways: readonly W[], step = 5): Scale<W> {
  if (ways.length === 0) throw new RangeError('The scale needs at least one way');
  if (!Number.isInteger(step) || step < 1) throw new RangeError(`The tick step must be a whole number of degrees, got ${step}`);
  for (const way of ways) {
    if (!(way.fromC < way.toC)) throw new RangeError(`Way "${way.name}" must start below where it ends (${way.fromC} to ${way.toC})`);
  }
  const min = Math.floor(Math.min(...ways.map((way) => way.fromC)) / step) * step;
  const max = Math.ceil(Math.max(...ways.map((way) => way.toC)) / step) * step;
  const columns = max - min;
  const ticks: number[] = [];
  for (let t = min; t < max; t += step) ticks.push(t);
  const rows = ways.map((way) => {
    const start = Math.round(way.fromC - min);
    const end = Math.max(start + 1, Math.round(way.toC - min));
    return { way, lead: start, span: end - start, tail: columns - end };
  });
  return { min, max, columns, ticks, rows };
}
