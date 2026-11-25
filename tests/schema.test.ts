import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blogPostingJsonLd, breadcrumbListJsonLd, jsonLdString, organizationJsonLd, productJsonLd,
  type BlogPostingInput, type ProductInput, type ProductJsonLd,
} from '../src/lib/schema.ts';

const ramoneska: ProductInput = {
  name: 'Ramoneska skórzana z podpinką',
  description: 'Czarna ramoneska na co dzień i na uczelnię, z podpinką zimową na zamek.',
  path: '/kolekcja/ramoneska-skorzana-z-podpinka/',
  images: ['/_astro/ramoneska.Ab12.webp'],
  brand: 'MONSUN',
  color: 'czarny',
  material: 'skóra',
};

const post: BlogPostingInput = {
  headline: 'Jak dbać o kurtkę skórzaną, gdy pada deszcz',
  description: 'Co zrobić z mokrą kurtką skórzaną: sprawdziliśmy to na własnej kurtce.',
  path: '/blog/jak-dbac-o-kurtke-skorzana/',
  images: ['/_astro/deszcz.Cd34.jpg'],
  datePublished: new Date('2026-11-27'),
  author: { name: 'Miłosz L.', slug: 'milosz' },
};

test('Organization has an absolute url and logo, the contact e-mail and the given profiles', () => {
  assert.deepEqual(organizationJsonLd({
    name: 'MONSUN',
    logo: '/apple-touch-icon.png',
    email: 'wearmonsun@gmail.com',
    sameAs: ['https://www.instagram.com/monsunjackets', 'https://www.tiktok.com/@monsunjackets'],
  }), {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://monsunjackets.github.io/#organization',
    name: 'MONSUN',
    url: 'https://monsunjackets.github.io/',
    logo: 'https://monsunjackets.github.io/apple-touch-icon.png',
    email: 'wearmonsun@gmail.com',
    sameAs: ['https://www.instagram.com/monsunjackets', 'https://www.tiktok.com/@monsunjackets'],
  });
});

test('Organization leaves out email and sameAs when there are none', () => {
  const org = organizationJsonLd({ name: 'MONSUN', logo: '/apple-touch-icon.png', sameAs: [] });
  assert.equal('email' in org, false);
  assert.equal('sameAs' in org, false);
});

test('Organization refuses a profile link that is not https, and a malformed e-mail', () => {
  for (const link of ['http://www.instagram.com/monsunjackets', 'instagram.com/monsunjackets', '@monsunjackets']) {
    assert.throws(() => organizationJsonLd({ name: 'MONSUN', logo: '/a.png', sameAs: [link] }), /sameAs must be an https URL/);
  }
  assert.throws(() => organizationJsonLd({ name: 'MONSUN', logo: '/a.png', email: 'wearmonsun' }), /email/);
});

test('Product has the canonical url, absolute images and the brand, and nothing about selling', () => {
  const product = productJsonLd(ramoneska);
  assert.deepEqual(product, {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Ramoneska skórzana z podpinką',
    description: 'Czarna ramoneska na co dzień i na uczelnię, z podpinką zimową na zamek.',
    url: 'https://monsunjackets.github.io/kolekcja/ramoneska-skorzana-z-podpinka/',
    image: ['https://monsunjackets.github.io/_astro/ramoneska.Ab12.webp'],
    brand: { '@type': 'Brand', name: 'MONSUN' },
    color: 'czarny',
    material: 'skóra',
  });
});

test('Product types reject offers, reviews and ratings, and the builder drops them if smuggled in', () => {
  const offers = { '@type': 'Offer', price: '1099', priceCurrency: 'PLN', availability: 'https://schema.org/PreOrder' };
  // @ts-expect-error: a planned price is not an offer.
  const withOffer: ProductInput = { ...ramoneska, offers };
  // @ts-expect-error: there are no reviews.
  const withReview: ProductInput = { ...ramoneska, review: { '@type': 'Review', reviewBody: 'Super' } };
  // @ts-expect-error: there are no ratings.
  const withRating: ProductInput = { ...ramoneska, aggregateRating: { '@type': 'AggregateRating', ratingValue: 5 } };
  // @ts-expect-error: the output type cannot carry one either.
  const output: ProductJsonLd = { ...productJsonLd(ramoneska), offers };

  for (const input of [withOffer, withReview, withRating]) {
    const product = productJsonLd(input);
    for (const field of ['offers', 'review', 'aggregateRating']) assert.equal(field in product, false, field);
    assert.doesNotMatch(jsonLdString(product), /Offer|Review|Rating|price/i);
  }
  assert.ok('offers' in output);
});

test('Product needs a name, a description and at least one image', () => {
  assert.throws(() => productJsonLd({ ...ramoneska, name: ' ' }), /Product.name is empty/);
  assert.throws(() => productJsonLd({ ...ramoneska, description: '' }), /Product.description is empty/);
  assert.throws(() => productJsonLd({ ...ramoneska, images: [] }), /Product.image needs at least one image/);
});

test('BlogPosting links the author page and dates the post with the Warsaw offset', () => {
  assert.deepEqual(blogPostingJsonLd({ ...post, dateModified: '2026-12-02T18:15' }), {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: 'Jak dbać o kurtkę skórzaną, gdy pada deszcz',
    description: 'Co zrobić z mokrą kurtką skórzaną: sprawdziliśmy to na własnej kurtce.',
    url: 'https://monsunjackets.github.io/blog/jak-dbac-o-kurtke-skorzana/',
    mainEntityOfPage: 'https://monsunjackets.github.io/blog/jak-dbac-o-kurtke-skorzana/',
    image: ['https://monsunjackets.github.io/_astro/deszcz.Cd34.jpg'],
    inLanguage: 'pl-PL',
    datePublished: '2026-11-27T00:00:00+01:00',
    dateModified: '2026-12-02T18:15:00+01:00',
    author: { '@type': 'Person', name: 'Miłosz L.', url: 'https://monsunjackets.github.io/autorzy/milosz/' },
  });
});

test('BlogPosting leaves out dateModified when unknown and keeps the author profiles', () => {
  const posting = blogPostingJsonLd({
    ...post,
    author: { ...post.author, sameAs: ['https://www.linkedin.com/in/example'] },
  });
  assert.equal('dateModified' in posting, false);
  assert.deepEqual(posting.author.sameAs, ['https://www.linkedin.com/in/example']);
});

test('BlogPosting refuses a malformed author slug and a modification before publication', () => {
  for (const slug of ['Milosz', 'miłosz', 'milosz/', '../admin', '', 'a--b', '-a']) {
    assert.throws(() => blogPostingJsonLd({ ...post, author: { ...post.author, slug } }), /Person.slug/, slug);
  }
  assert.throws(() => blogPostingJsonLd({ ...post, dateModified: '2026-11-26' }), /dateModified is before datePublished/);
  assert.throws(() => blogPostingJsonLd({ ...post, datePublished: '27.11.2026' }), RangeError);
});

test('BreadcrumbList numbers the items from 1 with canonical URLs', () => {
  assert.deepEqual(breadcrumbListJsonLd([
    { name: 'Strona główna', path: '/' },
    { name: 'Kolekcja', path: '/kolekcja' },
    { name: 'Ramoneska skórzana z podpinką', path: '/kolekcja/ramoneska-skorzana-z-podpinka/' },
  ]), {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Strona główna', item: 'https://monsunjackets.github.io/' },
      { '@type': 'ListItem', position: 2, name: 'Kolekcja', item: 'https://monsunjackets.github.io/kolekcja/' },
      {
        '@type': 'ListItem', position: 3, name: 'Ramoneska skórzana z podpinką',
        item: 'https://monsunjackets.github.io/kolekcja/ramoneska-skorzana-z-podpinka/',
      },
    ],
  });
  assert.throws(() => breadcrumbListJsonLd([]), /at least one item/);
});

test('jsonLdString escapes what could end the script element and still parses to the same value', () => {
  const product = productJsonLd({
    ...ramoneska,
    name: 'Kurtka </script><script>alert(1)</script>',
    description: 'A & B <!-- x --> \u2028 linia \u2029 akapit',
  });
  const json = jsonLdString(product);
  assert.doesNotMatch(json, /[<>&\u2028\u2029]/);
  assert.match(json, /\\u003c\/script\\u003e/);
  assert.match(json, /A \\u0026 B \\u003c!-- x --\\u003e \\u2028 linia \\u2029 akapit/);
  assert.deepEqual(JSON.parse(json), product);
});

test('jsonLdString serialises a list of nodes as a JSON array', () => {
  const nodes = [productJsonLd(ramoneska), breadcrumbListJsonLd([{ name: 'Kolekcja', path: '/kolekcja/' }])];
  assert.deepEqual(JSON.parse(jsonLdString(nodes)), nodes);
});
