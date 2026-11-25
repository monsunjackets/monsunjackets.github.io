// Content collections (ADR 0001 §3, widened in plan 0002 M5a). The schemas enforce the blog anatomy from the
// lecture and the honesty rules: a post without its keyword, author, date, answer, own photo, product link or
// AI disclosure fails the build, and every product image must say whether it is AI-made.
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { KEYWORDS, containsKeyword } from './lib/keywords.ts';

const products = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/products' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      title: z.string().max(70),
      description: z.string().max(160),
      order: z.number().int(),
      forWhom: z.string(),
      /** included: sold with the winter liner; compatible: sold without, takes any liner; liner: the liner itself */
      liner: z.enum(['included', 'compatible', 'liner']),
      keyword: z.enum(KEYWORDS).optional(),
      plannedPrice: z.object({ pln: z.number().int().positive(), note: z.string() }),
      benefits: z
        .array(z.object({ title: z.string(), proof: z.string(), href: z.string().optional() }))
        .length(3),
      images: z
        .array(
          z.object({
            src: image(),
            alt: z.string().min(10),
            ai: z.boolean(),
            state: z.enum(['in', 'out']).optional(),
          }),
        )
        .default([]),
      sizes: z
        .array(
          z.object({
            size: z.string(),
            chest: z.number(),
            chestWithLiner: z.number().optional(),
            back: z.number(),
            sleeve: z.number().optional(),
          }),
        )
        .default([]),
      sizesAreExample: z.boolean(),
      care: z.array(z.string()).min(1),
      faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
      provenance: z.array(z.object({ label: z.string(), text: z.string() })).default([]),
      updated: z.coerce.date(),
    }),
});

const posts = defineCollection({
  loader: glob({ pattern: '[!_]*.md', base: './src/content/posts' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().max(70),
        description: z.string().max(160),
        keyword: z.enum(KEYWORDS),
        author: reference('authors'),
        published: z.coerce.date(),
        updated: z.coerce.date().optional(),
        answer: z.string().min(80).max(400),
        photo: z.object({ src: image(), alt: z.string().min(10), by: z.string(), own: z.literal(true) }),
        product: reference('products'),
        aiUse: z.string().min(30),
        draft: z.boolean().default(false),
      })
      .refine((p) => containsKeyword(p.title, p.keyword), {
        path: ['title'],
        message: 'Tytuł musi zawierać słowo kluczowe',
      }),
});

const authors = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/authors' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      role: z.string(),
      bio: z.string(),
      photo: image().optional(),
      sameAs: z.array(z.url()).default([]),
    }),
});

const pages = defineCollection({
  loader: glob({ pattern: '{o-nas,gwarancja,rozmiary,prywatnosc,podpinka}.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string().max(70),
    description: z.string().max(160),
    updated: z.coerce.date(),
    ways: z
      .array(z.object({ name: z.string(), fromC: z.number(), toC: z.number(), months: z.string(), note: z.string().optional() }))
      .optional(),
  }),
});

export const collections = { products, posts, authors, pages };
