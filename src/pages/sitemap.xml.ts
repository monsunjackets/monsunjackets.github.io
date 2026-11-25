// /sitemap.xml (ADR 0001 §7): every public page, with lastmod only where the content records a real change.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../config/site.ts';
import { isListed } from '../lib/editorial.ts';
import { buildSitemapXml, type SitemapEntry } from '../lib/sitemap.ts';

export const GET: APIRoute = async () => {
  const production = import.meta.env.PROD;
  const products = (await getCollection('products')).sort((a, b) => a.data.order - b.data.order);
  const pages = await getCollection('pages');
  const posts = (await getCollection('posts')).filter((post) => isListed(post, production));
  const authors = await getCollection('authors');
  const entries: SitemapEntry[] = [
    { path: '/' },
    { path: '/kolekcja/' },
    ...products.map((p) => ({ path: `/kolekcja/${p.id}/`, lastmod: p.data.updated })),
    ...pages.map((p) => ({ path: `/${p.id}/`, lastmod: p.data.updated })),
    { path: '/blog/' },
    ...posts.map((p) => ({ path: `/blog/${p.id}/`, lastmod: p.data.updated ?? p.data.published })),
    ...authors.map((a) => ({ path: `/autorzy/${a.id}/` })),
  ];
  return new Response(buildSitemapXml(entries, site.url), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
