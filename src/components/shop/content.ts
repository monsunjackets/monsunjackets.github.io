// Build-time lookups in the content collections for the shop pages (catalogue, product pages, /podpinka/,
// /rozmiary/). Imports astro:content, so only Astro runs it; the logic it relies on is in the pure modules.
import { getCollection, type CollectionEntry } from 'astro:content';
import { GENERIC_PAGES, linkTarget } from './links.ts';

export type Product = CollectionEntry<'products'>;

/** Products in catalogue order. */
export async function getProducts(): Promise<Product[]> {
  const products = await getCollection('products');
  return products.sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id));
}

export function productPath(product: Product): string {
  return `/kolekcja/${product.id}/`;
}

// The generic pages exist only once their route exists too (it comes with chunk B5).
const genericRoute = Object.keys(import.meta.glob('/src/pages/*.astro')).some((path) => path.endsWith('/[page].astro'));

/** Paths of the content-dependent pages this build generates (see links.ts). */
export async function builtContentPaths(): Promise<Set<string>> {
  const products = await getCollection('products');
  const pages = genericRoute ? await getCollection('pages', (page) => (GENERIC_PAGES as readonly string[]).includes(page.id)) : [];
  return new Set([...products.map(productPath), ...pages.map((page) => `/${page.id}/`)]);
}

/** The href to render for a link from content, or null (with a build warning) while its page is not built. */
export function contentLink(href: string, built: ReadonlySet<string>, where: string): string | null {
  const target = linkTarget(href, built);
  if (target === null) console.warn(`[shop] ${where}: ${href} is not built yet, so it is shown without a link`);
  return target;
}
