// Typed builders for the JSON-LD blocks (ADR 0001 §7; research §4, P1).
//
// Contract:
// - organizationJsonLd(), productJsonLd(), blogPostingJsonLd() and breadcrumbListJsonLd() take plain objects and
//   return schema.org nodes with "@context". Page paths go through canonicalUrl() and image paths through
//   absoluteUrl() (seo.ts), both against SITE_URL, so every URL in the output is absolute.
// - Product never carries offers, review or aggregateRating: nothing is for sale and the prices are only planned.
//   Both the input and the output type declare these fields as `never`, so adding one is a type error, and the
//   builder copies named fields only, so a field smuggled past the types never reaches the page.
// - BlogPosting's author is a Person whose url is the author page /autorzy/<slug>/, and its dates are ISO 8601
//   with the Europe/Warsaw offset (dates.ts). dateModified appears only when given.
// - jsonLdString() serialises one node or a list of nodes for <script type="application/ld+json">, with "<", ">",
//   "&", U+2028 and U+2029 written as \uXXXX escapes, so the text cannot close or reopen the script element. The
//   result parses back to the same value.
// - Invalid input throws, naming the field: empty text, a malformed slug, an empty image or breadcrumb list,
//   a sameAs link that is not https, or dateModified before datePublished.
// No astro:* imports.

import { isoDateTime, toInstant, type DateInput } from './dates.ts';
import { absoluteUrl, canonicalUrl } from './seo.ts';

const CONTEXT = 'https://schema.org';
type Context = typeof CONTEXT;

// ---- Inputs ----

export interface OrganizationInput {
  name: string;
  /** Logo image: a site-root path or an absolute URL. */
  logo: string;
  email?: string;
  /** Profiles of the organisation (https URLs), e.g. the @monsunjackets accounts. */
  sameAs?: readonly string[];
}

export interface ProductInput {
  name: string;
  description: string;
  /** Product page path, e.g. "/kolekcja/ramoneska-skorzana-z-podpinka/". */
  path: string;
  /** At least one image: site-root paths or absolute URLs. */
  images: readonly string[];
  brand: string;
  color?: string;
  material?: string;
  /** Not for sale: no offer, no price in structured data. */
  offers?: never;
  /** No reviews exist; never invent them. */
  review?: never;
  /** No ratings exist; never invent them. */
  aggregateRating?: never;
}

export interface PersonInput {
  /** The display name the author approved (decision 6). */
  name: string;
  /** Author page slug: the author's url becomes /autorzy/<slug>/. */
  slug: string;
  /** Profiles the author agreed to link (https URLs). */
  sameAs?: readonly string[];
}

export interface BlogPostingInput {
  headline: string;
  description: string;
  /** Post page path, e.g. "/blog/jak-dbac-o-kurtke-skorzana/". */
  path: string;
  /** At least one image: site-root paths or absolute URLs. */
  images: readonly string[];
  datePublished: DateInput;
  dateModified?: DateInput;
  author: PersonInput;
}

export interface BreadcrumbInput {
  name: string;
  path: string;
}

// ---- Outputs ----

export interface OrganizationJsonLd {
  '@context': Context;
  '@type': 'Organization';
  '@id': string;
  name: string;
  url: string;
  logo: string;
  email?: string;
  sameAs?: string[];
}

export interface ProductJsonLd {
  '@context': Context;
  '@type': 'Product';
  name: string;
  description: string;
  url: string;
  image: string[];
  brand: { '@type': 'Brand'; name: string };
  color?: string;
  material?: string;
  offers?: never;
  review?: never;
  aggregateRating?: never;
}

export interface PersonJsonLd {
  '@type': 'Person';
  name: string;
  url: string;
  sameAs?: string[];
}

export interface BlogPostingJsonLd {
  '@context': Context;
  '@type': 'BlogPosting';
  headline: string;
  description: string;
  url: string;
  mainEntityOfPage: string;
  image: string[];
  inLanguage: 'pl-PL';
  datePublished: string;
  dateModified?: string;
  author: PersonJsonLd;
}

export interface BreadcrumbListJsonLd {
  '@context': Context;
  '@type': 'BreadcrumbList';
  itemListElement: { '@type': 'ListItem'; position: number; name: string; item: string }[];
}

export type JsonLd = OrganizationJsonLd | ProductJsonLd | BlogPostingJsonLd | BreadcrumbListJsonLd;

// ---- Checks ----

function text(field: string, value: string): string {
  const clean = value.trim();
  if (clean === '') throw new TypeError(`JSON-LD ${field} is empty`);
  return clean;
}

function images(field: string, list: readonly string[]): string[] {
  if (list.length === 0) throw new TypeError(`JSON-LD ${field} needs at least one image`);
  return list.map((image) => absoluteUrl(image));
}

function sameAs(field: string, list: readonly string[] | undefined): { sameAs?: string[] } {
  if (list === undefined || list.length === 0) return {};
  return {
    sameAs: list.map((link) => {
      const url = URL.canParse(link) ? new URL(link) : null;
      if (url?.protocol !== 'https:') throw new TypeError(`JSON-LD ${field} must be an https URL, got ${JSON.stringify(link)}`);
      return url.href;
    }),
  };
}

// ASCII slugs without diacritics (ADR 0001 §2).
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- Builders ----

export function organizationJsonLd(input: OrganizationInput): OrganizationJsonLd {
  const url = canonicalUrl('/');
  if (input.email !== undefined && !EMAIL.test(input.email)) {
    throw new TypeError(`JSON-LD Organization.email is not an address: ${JSON.stringify(input.email)}`);
  }
  return {
    '@context': CONTEXT,
    '@type': 'Organization',
    '@id': `${url}#organization`,
    name: text('Organization.name', input.name),
    url,
    logo: absoluteUrl(input.logo),
    ...(input.email === undefined ? {} : { email: input.email }),
    ...sameAs('Organization.sameAs', input.sameAs),
  };
}

export function productJsonLd(input: ProductInput): ProductJsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'Product',
    name: text('Product.name', input.name),
    description: text('Product.description', input.description),
    url: canonicalUrl(input.path),
    image: images('Product.image', input.images),
    brand: { '@type': 'Brand', name: text('Product.brand', input.brand) },
    ...(input.color === undefined ? {} : { color: text('Product.color', input.color) }),
    ...(input.material === undefined ? {} : { material: text('Product.material', input.material) }),
  };
}

export function personJsonLd(input: PersonInput): PersonJsonLd {
  if (!SLUG.test(input.slug)) {
    throw new TypeError(`JSON-LD Person.slug must be lowercase ASCII words joined by "-", got ${JSON.stringify(input.slug)}`);
  }
  return {
    '@type': 'Person',
    name: text('Person.name', input.name),
    url: canonicalUrl(`/autorzy/${input.slug}/`),
    ...sameAs('Person.sameAs', input.sameAs),
  };
}

export function blogPostingJsonLd(input: BlogPostingInput): BlogPostingJsonLd {
  const url = canonicalUrl(input.path);
  const { dateModified } = input;
  if (dateModified !== undefined && toInstant(dateModified) < toInstant(input.datePublished)) {
    throw new RangeError('JSON-LD BlogPosting.dateModified is before datePublished');
  }
  return {
    '@context': CONTEXT,
    '@type': 'BlogPosting',
    headline: text('BlogPosting.headline', input.headline),
    description: text('BlogPosting.description', input.description),
    url,
    mainEntityOfPage: url,
    image: images('BlogPosting.image', input.images),
    inLanguage: 'pl-PL',
    datePublished: isoDateTime(input.datePublished),
    ...(dateModified === undefined ? {} : { dateModified: isoDateTime(dateModified) }),
    author: personJsonLd(input.author),
  };
}

export function breadcrumbListJsonLd(items: readonly BreadcrumbInput[]): BreadcrumbListJsonLd {
  if (items.length === 0) throw new TypeError('JSON-LD BreadcrumbList needs at least one item');
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: text(`BreadcrumbList item ${index + 1} name`, crumb.name),
      item: canonicalUrl(crumb.path),
    })),
  };
}

// ---- Serialising ----

// Only ever inside JSON strings, so a \uXXXX escape keeps the JSON valid and the value unchanged.
const UNSAFE_IN_SCRIPT = /[<>&\u2028\u2029]/g;

export function jsonLdString(data: JsonLd | readonly JsonLd[]): string {
  return JSON.stringify(data).replace(
    UNSAFE_IN_SCRIPT,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}
