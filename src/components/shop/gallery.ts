// How a product's images become gallery slots (plan 0002 §2.3, asset spec „How to make a matching pair”).
//
// A photo pair („z podpinką” / „bez podpinki”) shares one slot, so the liner toggle can hide one state and the
// other takes its place. Without the toggle both photos of the pair stay visible, side by side.
// Pairing follows the content order: the first `in` image pairs with the first `out` image, the second with the
// second, and so on. A state image without a partner, and every image without a state, gets a slot of its own.
// Pairs come first, in the order of their earlier photo, so the toggle's photos take the gallery's large first
// slot even when the catalogue card image is listed first; single slots follow in content order.
// Pure functions with no astro:* imports, so Node runs them in tests.

import type { LinerState } from './format.ts';

export interface StatefulImage {
  state?: LinerState | undefined;
}

export type Slot<T> = { kind: 'single'; image: T } | { kind: 'pair'; in: T; out: T };

export function gallerySlots<T extends StatefulImage>(images: readonly T[]): Slot<T>[] {
  const ins = images.filter((image) => image.state === 'in');
  const outs = images.filter((image) => image.state === 'out');
  const partner = new Map<T, T>();
  for (let k = 0; k < Math.min(ins.length, outs.length); k++) {
    partner.set(ins[k]!, outs[k]!);
    partner.set(outs[k]!, ins[k]!);
  }

  const placed = new Set<T>();
  const pairs: Slot<T>[] = [];
  const singles: Slot<T>[] = [];
  for (const image of images) {
    if (placed.has(image)) continue;
    placed.add(image);
    const other = partner.get(image);
    if (other === undefined) {
      singles.push({ kind: 'single', image });
      continue;
    }
    placed.add(other);
    pairs.push(image.state === 'in' ? { kind: 'pair', in: image, out: other } : { kind: 'pair', in: other, out: image });
  }
  return [...pairs, ...singles];
}

/**
 * The image on the product's catalogue card: the first one. The schema has no field for the asset spec's `card`
 * view yet, so the content puts the card image first.
 */
export function cardImage<T>(images: readonly T[]): T | undefined {
  return images[0];
}
