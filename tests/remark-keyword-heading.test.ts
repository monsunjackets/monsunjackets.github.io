import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Heading, PhrasingContent, Root, RootContent, Text } from 'mdast';
import type { MdastPluginEntry } from 'satteri';
import {
  assertKeywordHeading,
  postPath,
  remarkKeywordHeading,
  subheadings,
} from '../src/lib/remark-keyword-heading.ts';

// Compile-time check that the plugin fits the installed Sätteri, so the astro.config.ts wiring type-checks.
const asSatteriEntry: MdastPluginEntry = remarkKeywordHeading;
void asSatteriEntry;

const KEYWORD = 'kurtka skórzana na zimę';
const POST = 'src/content/posts/kurtka-skorzana-na-zime.md';

const text = (value: string): Text => ({ type: 'text', value });
const heading = (depth: Heading['depth'], ...children: PhrasingContent[]): Heading => ({
  type: 'heading',
  depth,
  children,
});
const paragraph = (...children: PhrasingContent[]): RootContent => ({ type: 'paragraph', children });
const doc = (...children: RootContent[]): Root => ({ type: 'root', children });

const passes = (root: Root): void => assertKeywordHeading(root, KEYWORD, POST);
const fails = (root: Root): void => assert.throws(() => passes(root), /Śródtytuł \(## lub ###\) musi zawierać/);

describe('assertKeywordHeading', () => {
  test('passes when a ## heading contains the keyword', () => {
    passes(doc(heading(2, text('Jaka kurtka skórzana na zimę?'))));
  });

  test('passes when a ### heading contains the keyword', () => {
    passes(doc(heading(2, text('Test')), heading(3, text('Kurtka skórzana na zimę w praktyce'))));
  });

  test('ignores # and #### headings', () => {
    fails(doc(heading(1, text(KEYWORD)), heading(2, text('Test')), heading(4, text(KEYWORD))));
  });

  test('ignores the keyword in body text', () => {
    fails(doc(heading(2, text('Nasz test')), paragraph(text(`Każdy pyta, jaka ${KEYWORD} jest najlepsza.`))));
  });

  test('reads the keyword across emphasis, strong, links and inline code', () => {
    passes(
      doc(
        heading(
          2,
          text('Kurtka '),
          { type: 'strong', children: [text('skórzana')] },
          text(' '),
          { type: 'emphasis', children: [{ type: 'inlineCode', value: 'na' }] },
          text(' '),
          { type: 'link', url: '/kolekcja/', children: [text('zimę')] },
        ),
      ),
    );
  });

  test('reads text between inline HTML tags but not the tags', () => {
    passes(
      doc(
        heading(
          2,
          text('Kurtka '),
          { type: 'html', value: '<em>' },
          text('skórzana'),
          { type: 'html', value: '</em>' },
          text(' na zimę'),
        ),
      ),
    );
  });

  test('does not count the alt text of an image in a heading', () => {
    fails(doc(heading(2, { type: 'image', url: 'a.jpg', alt: KEYWORD }, text(' Zdjęcie z testu'))));
  });

  test('reads a line break or a wrapped heading line as a space', () => {
    passes(doc(heading(2, text('Kurtka skórzana'), { type: 'break' }, text('na zimę'))));
    passes(doc(heading(2, text('Kurtka skórzana\nna zimę'))));
  });

  test('finds headings nested in a blockquote', () => {
    passes(doc({ type: 'blockquote', children: [heading(2, text(KEYWORD))] }));
  });

  test('rejects an inflected form, naming the file, the rule and the headings found', () => {
    const root = doc(heading(2, text('Kurtki skórzane na zimę')), heading(3, text('Nasz test')));
    assert.throws(() => passes(root), {
      message:
        `${POST}: Śródtytuł (## lub ###) musi zawierać słowo kluczowe: „${KEYWORD}”, w tej samej formie, bez odmiany. ` +
        'Śródtytuły we wpisie: „Kurtki skórzane na zimę”, „Nasz test”.',
    });
  });

  test('says so when the post has no subheadings', () => {
    assert.throws(() => passes(doc(paragraph(text(KEYWORD)))), /Wpis nie ma śródtytułów ## ani ###\./);
  });
});

describe('subheadings', () => {
  test('lists ## and ### heading text in document order', () => {
    const root = doc(heading(2, text('Pierwszy')), heading(4, text('Pominięty')), heading(3, text('Drugi')));
    assert.deepEqual(subheadings(root), ['Pierwszy', 'Drugi']);
  });
});

describe('postPath', () => {
  test('returns the path from the site root for a post', () => {
    assert.equal(postPath(new URL(`file:///work/${POST}`)), POST);
    assert.equal(postPath(new URL(`file:///C:/Users/a/site/${POST}`)), POST);
    assert.equal(postPath(new URL('file:///home/a%20b/site/src/content/posts/%C5%BC.md')), 'src/content/posts/ż.md');
  });

  test('returns null for other files', () => {
    assert.equal(postPath(new URL('file:///work/src/content/pages/o-nas.md')), null);
    assert.equal(postPath(new URL('file:///work/src/pages/posts/a.md')), null);
    assert.equal(postPath(undefined), null);
  });
});

describe('remarkKeywordHeading', () => {
  const context = (path: string, frontmatter: Record<string, unknown>) => ({
    fileURL: new URL(`file:///work/${path}`),
    data: { astro: { frontmatter } },
  });

  test('stays out of files that are not posts', () => {
    assert.equal(remarkKeywordHeading(context('src/content/pages/o-nas.md', {})), null);
    assert.equal(remarkKeywordHeading({ fileURL: undefined, data: {} }), null);
  });

  test('checks a post against the keyword in its front matter', () => {
    const plugin = remarkKeywordHeading(context(POST, { keyword: KEYWORD }));
    assert.ok(plugin);
    plugin.after(doc(heading(2, text('Kurtka skórzana na zimę: test'))));
    assert.throws(() => plugin.after(doc(heading(2, text('Ramoneska skórzana')))), (error: Error) =>
      error.message.startsWith(`${POST}: Śródtytuł (## lub ###) musi zawierać słowo kluczowe: „${KEYWORD}”`),
    );
  });

  test('throws, naming the file, when the post has no known keyword', () => {
    assert.throws(() => remarkKeywordHeading(context(POST, {})), new RegExp(`^Error: ${POST}: Pole keyword`));
    assert.throws(() => remarkKeywordHeading(context(POST, { keyword: 'kurtki skórzane' })), /Pole keyword/);
    assert.throws(() => remarkKeywordHeading({ fileURL: new URL(`file:///work/${POST}`), data: {} }), /Pole keyword/);
  });
});
