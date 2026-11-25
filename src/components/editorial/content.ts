// Content queries shared by the editorial pages. The rules themselves are pure functions in src/lib/editorial.ts;
// this file only applies them to the collections.
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { byNewest, isListed } from '../../lib/editorial.ts';

/** The posts this build shows, newest first: every post in `astro dev`, published ones only in production. */
export async function listedPosts(): Promise<CollectionEntry<'posts'>[]> {
  const posts = await getCollection('posts', (post) => isListed(post, import.meta.env.PROD));
  return posts.sort(byNewest);
}

/** A post's author entry. The schema's reference() already fails the build on an unknown id. */
export async function authorOf(post: CollectionEntry<'posts'>): Promise<CollectionEntry<'authors'>> {
  const author = await getEntry(post.data.author);
  if (!author) throw new Error(`${post.filePath ?? post.id}: no author „${post.data.author.id}” in src/content/authors/`);
  return author;
}

/** A post's product entry, for the product card. */
export async function productOf(post: CollectionEntry<'posts'>): Promise<CollectionEntry<'products'>> {
  const product = await getEntry(post.data.product);
  if (!product) throw new Error(`${post.filePath ?? post.id}: no product „${post.data.product.id}” in src/content/products/`);
  return product;
}

/**
 * Short names of the content pages, for breadcrumbs. The page titles are search titles and too long for that.
 * The same names suit the header and footer links (see the B5 report).
 */
export const PAGE_NAMES = {
  podpinka: 'Jak działa podpinka',
  'o-nas': 'O nas',
  gwarancja: 'Gwarancja',
  rozmiary: 'Rozmiary',
  prywatnosc: 'Prywatność',
} as const satisfies Record<string, string>;

export type PageId = keyof typeof PAGE_NAMES;
