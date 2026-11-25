// liner-toggle: when the switch is worth rendering. Build-time only (no browser code), so Node's test runner can
// load it directly. The types mirror the `products` schema in src/content.config.ts without importing astro:content.

/** `included`: sold with the winter liner; `compatible`: takes any liner; `liner`: the liner itself. */
export type LinerKind = 'included' | 'compatible' | 'liner';
export type LinerState = 'in' | 'out';

/** The one field of a product image the switch needs; the collection's image entries satisfy it as they are. */
export interface LinerImage {
  state?: LinerState | undefined;
}

/** True when the images hold at least one photo of each state, so either choice leaves something to look at. */
export function hasLinerPair(images: readonly LinerImage[]): boolean {
  return images.some((image) => image.state === 'in') && images.some((image) => image.state === 'out');
}

/** The liner itself has no „with/without liner” view; a jacket needs both photos for the switch to show anything. */
export function showsLinerToggle(liner: LinerKind, images: readonly LinerImage[]): boolean {
  return liner !== 'liner' && hasLinerPair(images);
}

/**
 * Groups a gallery for the cross-fade: the n-th `in` photo and the n-th `out` photo form one slot `[in, out]`, placed
 * where the first of the two appears; every other photo is a slot of its own. Render a two-photo slot as one
 * element holding just those two figures (README.md, "Markup").
 */
export function linerSlots<T extends LinerImage>(images: readonly T[]): T[][] {
  const ins = images.filter((image) => image.state === 'in');
  const outs = images.filter((image) => image.state === 'out');
  const partner = new Map<T, T>();
  for (let i = 0; i < Math.min(ins.length, outs.length); i++) {
    partner.set(ins[i]!, outs[i]!);
    partner.set(outs[i]!, ins[i]!);
  }
  const placed = new Set<T>();
  const slots: T[][] = [];
  for (const image of images) {
    if (placed.has(image)) continue;
    const other = partner.get(image);
    slots.push(other === undefined ? [image] : image.state === 'in' ? [image, other] : [other, image]);
    placed.add(image);
    if (other !== undefined) placed.add(other);
  }
  return slots;
}
